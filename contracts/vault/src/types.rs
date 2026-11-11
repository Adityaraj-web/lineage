use near_sdk::json_types::U128;
use near_sdk::{near, AccountId};

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Mode {
    Lineage,
    LimitsOnly,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct SignedPayeeInput {
    pub account_id: AccountId,
    pub max_amount: U128,
    pub label: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct SignedPayee {
    pub account_id: AccountId,
    pub max_amount: U128,
    pub committed: U128,
    pub label: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Task {
    pub id: u32,
    pub agent: AccountId,
    pub instruction: String,
    pub budget: U128,
    pub spent: U128,
    pub reserved: U128,
    pub max_per_payment: U128,
    pub created_at_ms: u64,
    pub expires_at_ms: u64,
    pub signed_payees: Vec<SignedPayee>,
    pub resolvers: Vec<AccountId>,
    pub closed: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub enum PayeeRef {
    Signed { slot: u32 },
    Resolved { resolver: AccountId, reference: String },
    Raw { account_id: AccountId },
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Provenance {
    UserSigned { slot: u32 },
    Resolved { resolver: AccountId, reference: String },
    Untrusted,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum PaymentStatus {
    Resolving,
    AwaitingApproval,
    Sending,
    Paid,
    Failed,
    Rejected,
    Blocked,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Payment {
    pub id: u32,
    pub task_id: u32,
    pub agent: AccountId,
    pub payee: Option<AccountId>,
    pub amount: U128,
    pub provenance: Provenance,
    pub status: PaymentStatus,
    pub reason: String,
    pub memo: String,
    pub created_at_ms: u64,
    pub updated_at_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Resolution {
    pub payee: AccountId,
    pub amount: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct PayeeStats {
    pub payments: u32,
    pub total: U128,
    pub first_paid_at_ms: u64,
    pub last_paid_at_ms: u64,
}

#[near(serializers = [json])]
pub struct ConfigView {
    pub owner: AccountId,
    pub token: AccountId,
    pub mode: Mode,
    pub frozen: bool,
    pub balance: U128,
    pub total_reserved: U128,
    pub task_count: u32,
    pub payment_count: u32,
}
