mod types;
#[cfg(test)]
mod tests;

pub use types::*;

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue,
};

pub const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
pub const FT_STORAGE_DEPOSIT: NearToken = NearToken::from_yoctonear(1_250_000_000_000_000_000_000);
const GAS_STORAGE_DEPOSIT: Gas = Gas::from_tgas(10);
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(15);
const GAS_ON_TRANSFER: Gas = Gas::from_tgas(15);
const GAS_RESOLVE: Gas = Gas::from_tgas(10);
const GAS_ON_RESOLVED: Gas = Gas::from_tgas(70);
const MAX_MEMO_LEN: usize = 200;

#[ext_contract(ext_ft)]
pub trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>);
}

#[ext_contract(ext_resolver)]
pub trait LineageResolver {
    fn lineage_resolve(&self, reference: String) -> Option<Resolution>;
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Tasks,
    Payments,
    PayeeStats,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct LineageVault {
    owner: AccountId,
    token: AccountId,
    mode: Mode,
    frozen: bool,
    balance: u128,
    total_reserved: u128,
    tasks: Vector<Task>,
    payments: Vector<Payment>,
    payee_stats: LookupMap<AccountId, PayeeStats>,
}

#[near]
impl LineageVault {
    #[init]
    pub fn new(owner: AccountId, token: AccountId, mode: Mode) -> Self {
        Self {
            owner,
            token,
            mode,
            frozen: false,
            balance: 0,
            total_reserved: 0,
            tasks: Vector::new(StorageKey::Tasks),
            payments: Vector::new(StorageKey::Payments),
            payee_stats: LookupMap::new(StorageKey::PayeeStats),
        }
    }

    // ------------------------------------------------------------------ owner

    #[payable]
    #[allow(clippy::too_many_arguments)]
    pub fn create_task(
        &mut self,
        agent: AccountId,
        instruction: String,
        budget: U128,
        max_per_payment: U128,
        ttl_minutes: u64,
        signed_payees: Vec<SignedPayeeInput>,
        resolvers: Vec<AccountId>,
    ) -> u32 {
        self.assert_owner_full_access();
        require!(budget.0 > 0, "Budget must be positive");
        require!(
            max_per_payment.0 > 0 && max_per_payment.0 <= budget.0,
            "max_per_payment must be positive and not exceed budget"
        );
        require!(ttl_minutes > 0, "ttl_minutes must be positive");
        require!(instruction.len() <= 1000, "Instruction too long");
        require!(signed_payees.len() <= 20, "At most 20 signed payees");
        require!(resolvers.len() <= 5, "At most 5 resolvers");

        let now = env::block_timestamp_ms();
        let id = self.tasks.len();
        let task = Task {
            id,
            agent,
            instruction,
            budget,
            spent: U128(0),
            reserved: U128(0),
            max_per_payment,
            created_at_ms: now,
            expires_at_ms: now + ttl_minutes * 60_000,
            signed_payees: signed_payees
                .into_iter()
                .map(|p| SignedPayee {
                    account_id: p.account_id,
                    max_amount: p.max_amount,
                    committed: U128(0),
                    label: p.label,
                })
                .collect(),
            resolvers,
            closed: false,
        };
        self.emit("task_created", json!(task));
        self.tasks.push(task);
        id
    }

    #[payable]
    pub fn close_task(&mut self, task_id: u32) {
        self.assert_owner_full_access();
        let task = self.tasks.get_mut(task_id).expect("No such task");
        task.closed = true;
    }

    pub fn freeze(&mut self) {
        self.assert_owner();
        self.frozen = true;
        self.emit("vault_frozen", json!({ "frozen": true }));
    }

    #[payable]
    pub fn unfreeze(&mut self) {
        self.assert_owner_full_access();
        self.frozen = false;
        self.emit("vault_frozen", json!({ "frozen": false }));
    }

    #[payable]
    pub fn approve_payment(&mut self, payment_id: u32) -> PromiseOrValue<Payment> {
        self.assert_owner_full_access();
        let payment = self.payment(payment_id);
        require!(
            payment.status == PaymentStatus::AwaitingApproval,
            "Payment is not awaiting approval"
        );
        let task = self.task(payment.task_id);
        let payee = payment.payee.clone().expect("Pending payment has a payee");
        match self.check_limits(&task, payment.amount.0) {
            Err(reason) => PromiseOrValue::Value(self.finish(payment_id, PaymentStatus::Blocked, reason)),
            Ok(()) => PromiseOrValue::Promise(self.start_transfer(payment_id, payee, payment.amount.0)),
        }
    }

    #[payable]
    pub fn reject_payment(&mut self, payment_id: u32, reason: Option<String>) -> Payment {
        self.assert_owner_full_access();
        let payment = self.payment(payment_id);
        require!(
            payment.status == PaymentStatus::AwaitingApproval,
            "Payment is not awaiting approval"
        );
        self.finish(
            payment_id,
            PaymentStatus::Rejected,
            reason.unwrap_or_else(|| "Rejected by owner".to_string()),
        )
    }

    #[payable]
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        self.assert_owner_full_access();
        require!(
            amount.0 <= self.balance.saturating_sub(self.total_reserved),
            "Amount exceeds unreserved balance"
        );
        self.balance -= amount.0;
        ext_ft::ext(self.token.clone())
            .with_attached_deposit(ONE_YOCTO)
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(self.owner.clone(), amount, Some("lineage withdraw".to_string()))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_TRANSFER)
                    .on_withdraw(amount),
            )
    }

    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        require!(
            env::predecessor_account_id() == self.token,
            "Only the configured token can be deposited"
        );
        let _ = msg;
        self.balance += amount.0;
        self.emit("deposit", json!({ "sender_id": sender_id, "amount": amount }));
        PromiseOrValue::Value(U128(0))
    }

    // ------------------------------------------------------------------ agent

    pub fn request_payment(
        &mut self,
        task_id: u32,
        payee: PayeeRef,
        amount: U128,
        memo: Option<String>,
    ) -> PromiseOrValue<Payment> {
        let agent = env::predecessor_account_id();
        let task = self.task(task_id);
        require!(task.agent == agent, "Only this task's agent can request payments");

        let mut memo = memo.unwrap_or_default();
        if memo.len() > MAX_MEMO_LEN {
            let mut cut = MAX_MEMO_LEN;
            while !memo.is_char_boundary(cut) {
                cut -= 1;
            }
            memo.truncate(cut);
        }
        let now = env::block_timestamp_ms();
        let mut payment = Payment {
            id: self.payments.len(),
            task_id,
            agent,
            payee: None,
            amount,
            provenance: Provenance::Untrusted,
            status: PaymentStatus::Blocked,
            reason: String::new(),
            memo,
            created_at_ms: now,
            updated_at_ms: now,
        };

        match payee {
            PayeeRef::Signed { slot } => {
                payment.provenance = Provenance::UserSigned { slot };
                let Some(signed) = task.signed_payees.get(slot as usize).cloned() else {
                    return self.blocked(payment, format!("No payee signed by the owner in slot {slot}"));
                };
                payment.payee = Some(signed.account_id.clone());
                if signed.committed.0 + amount.0 > signed.max_amount.0 {
                    return self.blocked(
                        payment,
                        format!(
                            "Exceeds what the owner signed for '{}': max {}, already committed {}",
                            signed.label, signed.max_amount.0, signed.committed.0
                        ),
                    );
                }
                if let Err(reason) = self.check_limits(&task, amount.0) {
                    return self.blocked(payment, reason);
                }
                payment.status = PaymentStatus::Sending;
                let id = self.record(payment);
                PromiseOrValue::Promise(self.start_transfer(id, signed.account_id, amount.0))
            }

            PayeeRef::Resolved { resolver, reference } => {
                payment.provenance = Provenance::Resolved {
                    resolver: resolver.clone(),
                    reference: reference.clone(),
                };
                if !task.resolvers.contains(&resolver) {
                    return self.blocked(payment, format!("Resolver {resolver} is not pinned in this task"));
                }
                if let Err(reason) = self.check_limits(&task, amount.0) {
                    return self.blocked(payment, reason);
                }
                payment.status = PaymentStatus::Resolving;
                payment.reason = format!("Asking {resolver} who '{reference}' is");
                let id = self.record(payment);
                self.reserve(task_id, amount.0);
                PromiseOrValue::Promise(
                    ext_resolver::ext(resolver)
                        .with_static_gas(GAS_RESOLVE)
                        .lineage_resolve(reference)
                        .then(
                            Self::ext(env::current_account_id())
                                .with_static_gas(GAS_ON_RESOLVED)
                                .on_resolved(id, amount),
                        ),
                )
            }

            PayeeRef::Raw { account_id } => {
                payment.provenance = Provenance::Untrusted;
                payment.payee = Some(account_id.clone());
                if let Err(reason) = self.check_limits(&task, amount.0) {
                    return self.blocked(payment, reason);
                }
                match self.mode {
                    Mode::Lineage => {
                        payment.status = PaymentStatus::AwaitingApproval;
                        payment.reason = "Payee address came from untrusted input: not signed by the owner \
                                          and not resolved on-chain. Owner approval required."
                            .to_string();
                        let id = self.record(payment);
                        PromiseOrValue::Value(self.payment(id))
                    }
                    Mode::LimitsOnly => {
                        payment.status = PaymentStatus::Sending;
                        let id = self.record(payment);
                        PromiseOrValue::Promise(self.start_transfer(id, account_id, amount.0))
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ callbacks

    #[private]
    pub fn on_resolved(
        &mut self,
        payment_id: u32,
        ceiling: U128,
        #[callback_result] result: Result<Option<Resolution>, PromiseError>,
    ) -> PromiseOrValue<Payment> {
        let payment = self.payment(payment_id);
        self.release(payment.task_id, ceiling.0);
        let reference = match &payment.provenance {
            Provenance::Resolved { reference, .. } => reference.clone(),
            _ => env::panic_str("Payment is not a resolved payment"),
        };

        let resolution = match result {
            Err(_) => {
                return PromiseOrValue::Value(self.finish(
                    payment_id,
                    PaymentStatus::Failed,
                    "Resolver call failed".to_string(),
                ))
            }
            Ok(None) => {
                return PromiseOrValue::Value(self.finish(
                    payment_id,
                    PaymentStatus::Blocked,
                    format!("Resolver has no verified payee for '{reference}'"),
                ))
            }
            Ok(Some(r)) => r,
        };

        if let Some(p) = self.payments.get_mut(payment_id) {
            p.payee = Some(resolution.payee.clone());
            p.amount = resolution.amount;
        }
        if resolution.amount.0 > ceiling.0 {
            return PromiseOrValue::Value(self.finish(
                payment_id,
                PaymentStatus::Blocked,
                format!(
                    "Resolved price {} exceeds the agent's ceiling {}",
                    resolution.amount.0, ceiling.0
                ),
            ));
        }
        let task = self.task(payment.task_id);
        if let Err(reason) = self.check_limits(&task, resolution.amount.0) {
            return PromiseOrValue::Value(self.finish(payment_id, PaymentStatus::Blocked, reason));
        }
        PromiseOrValue::Promise(self.start_transfer(payment_id, resolution.payee, resolution.amount.0))
    }

    #[private]
    pub fn on_transfer_complete(
        &mut self,
        payment_id: u32,
        #[callback_result] result: Result<(), PromiseError>,
    ) -> Payment {
        let payment = self.payment(payment_id);
        let amount = payment.amount.0;
        self.release(payment.task_id, amount);

        if result.is_ok() {
            let now = env::block_timestamp_ms();
            if let Some(task) = self.tasks.get_mut(payment.task_id) {
                task.spent = U128(task.spent.0 + amount);
            }
            self.balance -= amount;
            let payee = payment.payee.clone().expect("Sent payment has a payee");
            let mut stats = self.payee_stats.get(&payee).cloned().unwrap_or_default();
            if stats.payments == 0 {
                stats.first_paid_at_ms = now;
            }
            stats.payments += 1;
            stats.total = U128(stats.total.0 + amount);
            stats.last_paid_at_ms = now;
            self.payee_stats.insert(payee, stats);
            self.finish(payment_id, PaymentStatus::Paid, "Paid".to_string())
        } else {
            if let Provenance::UserSigned { slot } = payment.provenance {
                if let Some(task) = self.tasks.get_mut(payment.task_id) {
                    if let Some(s) = task.signed_payees.get_mut(slot as usize) {
                        s.committed = U128(s.committed.0.saturating_sub(amount));
                    }
                }
            }
            self.finish(
                payment_id,
                PaymentStatus::Failed,
                "Token transfer failed; budget released".to_string(),
            )
        }
    }

    #[private]
    pub fn on_withdraw(&mut self, amount: U128, #[callback_result] result: Result<(), PromiseError>) {
        if result.is_err() {
            self.balance += amount.0;
        }
    }

    // ------------------------------------------------------------------ views

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            owner: self.owner.clone(),
            token: self.token.clone(),
            mode: self.mode.clone(),
            frozen: self.frozen,
            balance: U128(self.balance),
            total_reserved: U128(self.total_reserved),
            task_count: self.tasks.len(),
            payment_count: self.payments.len(),
        }
    }

    pub fn get_task(&self, task_id: u32) -> Option<Task> {
        self.tasks.get(task_id).cloned()
    }

    pub fn get_tasks(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Task> {
        let from = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(50);
        self.tasks.iter().skip(from as usize).take(limit as usize).cloned().collect()
    }

    pub fn get_payment(&self, payment_id: u32) -> Option<Payment> {
        self.payments.get(payment_id).cloned()
    }

    pub fn get_payments(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Payment> {
        let from = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(50);
        self.payments.iter().skip(from as usize).take(limit as usize).cloned().collect()
    }

    pub fn get_awaiting_approval(&self) -> Vec<Payment> {
        self.payments
            .iter()
            .filter(|p| p.status == PaymentStatus::AwaitingApproval)
            .cloned()
            .collect()
    }

    pub fn get_payee_stats(&self, account_id: AccountId) -> PayeeStats {
        self.payee_stats.get(&account_id).cloned().unwrap_or_default()
    }

    // ------------------------------------------------------------------ internal

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Owner only");
    }

    fn assert_owner_full_access(&self) {
        self.assert_owner();
        require!(
            env::attached_deposit() == ONE_YOCTO,
            "Attach exactly 1 yoctoNEAR (requires a full-access key)"
        );
    }

    fn task(&self, task_id: u32) -> Task {
        self.tasks.get(task_id).cloned().expect("No such task")
    }

    fn payment(&self, payment_id: u32) -> Payment {
        self.payments.get(payment_id).cloned().expect("No such payment")
    }

    fn check_limits(&self, task: &Task, amount: u128) -> Result<(), String> {
        let now = env::block_timestamp_ms();
        if self.frozen {
            return Err("Vault is frozen by the owner".to_string());
        }
        if task.closed {
            return Err("Task is closed".to_string());
        }
        if now > task.expires_at_ms {
            return Err("Task mandate has expired".to_string());
        }
        if amount == 0 {
            return Err("Amount must be positive".to_string());
        }
        if amount > task.max_per_payment.0 {
            return Err(format!(
                "Amount {} exceeds per-payment limit {}",
                amount, task.max_per_payment.0
            ));
        }
        if task.spent.0 + task.reserved.0 + amount > task.budget.0 {
            return Err(format!(
                "Exceeds task budget: budget {}, spent {}, in flight {}",
                task.budget.0, task.spent.0, task.reserved.0
            ));
        }
        if amount > self.balance.saturating_sub(self.total_reserved) {
            return Err("Vault balance is insufficient".to_string());
        }
        Ok(())
    }

    fn reserve(&mut self, task_id: u32, amount: u128) {
        let task = self.tasks.get_mut(task_id).expect("No such task");
        task.reserved = U128(task.reserved.0 + amount);
        self.total_reserved += amount;
    }

    fn release(&mut self, task_id: u32, amount: u128) {
        let task = self.tasks.get_mut(task_id).expect("No such task");
        task.reserved = U128(task.reserved.0.saturating_sub(amount));
        self.total_reserved = self.total_reserved.saturating_sub(amount);
    }

    fn record(&mut self, payment: Payment) -> u32 {
        let id = payment.id;
        if payment.status != PaymentStatus::Sending {
            self.emit(Self::event_name(&payment.status), json!(payment));
        }
        self.payments.push(payment);
        id
    }

    fn blocked(&mut self, mut payment: Payment, reason: String) -> PromiseOrValue<Payment> {
        payment.status = PaymentStatus::Blocked;
        payment.reason = reason;
        let id = self.record(payment);
        PromiseOrValue::Value(self.payment(id))
    }

    fn finish(&mut self, payment_id: u32, status: PaymentStatus, reason: String) -> Payment {
        let now = env::block_timestamp_ms();
        let p = self.payments.get_mut(payment_id).expect("No such payment");
        p.status = status;
        p.reason = reason;
        p.updated_at_ms = now;
        let snapshot = p.clone();
        self.emit(Self::event_name(&snapshot.status), json!(snapshot));
        snapshot
    }

    fn start_transfer(&mut self, payment_id: u32, payee: AccountId, amount: u128) -> Promise {
        let task_id = self.payment(payment_id).task_id;
        self.reserve(task_id, amount);
        let provenance = self.payment(payment_id).provenance;
        if let Provenance::UserSigned { slot } = provenance {
            let task = self.tasks.get_mut(task_id).expect("No such task");
            let s = task.signed_payees.get_mut(slot as usize).expect("No such slot");
            s.committed = U128(s.committed.0 + amount);
        }
        let memo = {
            let p = self.payments.get_mut(payment_id).expect("No such payment");
            p.payee = Some(payee.clone());
            p.amount = U128(amount);
            p.status = PaymentStatus::Sending;
            p.reason = "Transfer in flight".to_string();
            p.updated_at_ms = env::block_timestamp_ms();
            format!("lineage #{} {}", p.id, p.memo)
        };
        self.emit("payment_sending", json!(self.payment(payment_id)));

        ext_ft::ext(self.token.clone())
            .with_attached_deposit(FT_STORAGE_DEPOSIT)
            .with_static_gas(GAS_STORAGE_DEPOSIT)
            .storage_deposit(Some(payee.clone()), Some(true))
            .then(
                ext_ft::ext(self.token.clone())
                    .with_attached_deposit(ONE_YOCTO)
                    .with_static_gas(GAS_FT_TRANSFER)
                    .ft_transfer(payee, U128(amount), Some(memo)),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_ON_TRANSFER)
                    .on_transfer_complete(payment_id),
            )
    }

    fn event_name(status: &PaymentStatus) -> &'static str {
        match status {
            PaymentStatus::Resolving => "payment_resolving",
            PaymentStatus::AwaitingApproval => "payment_awaiting_approval",
            PaymentStatus::Sending => "payment_sending",
            PaymentStatus::Paid => "payment_paid",
            PaymentStatus::Failed => "payment_failed",
            PaymentStatus::Rejected => "payment_rejected",
            PaymentStatus::Blocked => "payment_blocked",
        }
    }

    fn emit(&self, event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({ "standard": "lineage", "version": "1.0.0", "event": event, "data": [data] })
        ));
    }
}
