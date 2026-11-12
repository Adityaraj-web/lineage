use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;

const MINUTE_NS: u64 = 60_000_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}
fn vault() -> AccountId {
    acc("vault.lineage.testnet")
}
fn owner() -> AccountId {
    acc("owner.testnet")
}
fn agent() -> AccountId {
    acc("agent.lineage.testnet")
}
fn token() -> AccountId {
    acc("usdc.lineage.testnet")
}
fn registry() -> AccountId {
    acc("registry.lineage.testnet")
}
fn alice() -> AccountId {
    acc("alice.testnet")
}
fn attacker() -> AccountId {
    acc("vendor-payments.testnet")
}
fn usdc(n: u128) -> U128 {
    U128(n * 1_000_000)
}

fn call_as(who: AccountId, deposit: NearToken, at_ns: u64) {
    let ctx = VMContextBuilder::new()
        .current_account_id(vault())
        .predecessor_account_id(who.clone())
        .signer_account_id(who)
        .attached_deposit(deposit)
        .block_timestamp(at_ns)
        .build();
    testing_env!(ctx);
}

fn setup(mode: Mode) -> LineageVault {
    call_as(owner(), NearToken::from_yoctonear(0), 0);
    let mut v = LineageVault::new(owner(), token(), mode);
    call_as(token(), NearToken::from_yoctonear(0), 0);
    let _ = v.ft_on_transfer(owner(), usdc(1_000), String::new());
    call_as(owner(), ONE_YOCTO, 0);
    v.create_task(
        agent(),
        "Get the landing page translated to Hindi. Pay Alice for the logo.".to_string(),
        usdc(100),
        usdc(50),
        60,
        vec![SignedPayeeInput {
            account_id: alice(),
            max_amount: usdc(20),
            label: "Alice - logo".to_string(),
        }],
        vec![registry()],
    );
    v
}

fn value(r: PromiseOrValue<Payment>) -> Payment {
    match r {
        PromiseOrValue::Value(p) => p,
        PromiseOrValue::Promise(_) => panic!("expected an immediate value, got a promise"),
    }
}

fn expect_promise(r: PromiseOrValue<Payment>) {
    if let PromiseOrValue::Value(p) = r {
        panic!("expected a promise, got {:?}: {}", p.status, p.reason);
    }
}

#[test]
fn p1_signed_payee_within_cap_is_sent_then_paid() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    expect_promise(v.request_payment(0, PayeeRef::Signed { slot: 0 }, usdc(15), Some("logo".into())));
    let p = v.get_payment(0).unwrap();
    assert_eq!(p.status, PaymentStatus::Sending);
    assert_eq!(p.payee, Some(alice()));
    assert_eq!(v.get_task(0).unwrap().reserved, usdc(15));

    call_as(vault(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = v.on_transfer_complete(0, Ok(()));
    assert_eq!(p.status, PaymentStatus::Paid);
    let t = v.get_task(0).unwrap();
    assert_eq!(t.spent, usdc(15));
    assert_eq!(t.reserved, U128(0));
    assert_eq!(v.get_config().balance, usdc(985));
    assert_eq!(v.get_payee_stats(alice()).payments, 1);
}

#[test]
fn p1_over_signed_cap_is_blocked() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(0, PayeeRef::Signed { slot: 0 }, usdc(25), None));
    assert_eq!(p.status, PaymentStatus::Blocked);
    assert!(p.reason.contains("Exceeds what the owner signed"));
}

#[test]
fn p1_missing_slot_is_blocked() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(0, PayeeRef::Signed { slot: 7 }, usdc(1), None));
    assert_eq!(p.status, PaymentStatus::Blocked);
}

#[test]
fn p3_raw_address_awaits_approval_in_lineage_mode() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(
        0,
        PayeeRef::Raw { account_id: attacker() },
        usdc(49),
        Some("Invoice #4471 - updated payout wallet".into()),
    ));
    assert_eq!(p.status, PaymentStatus::AwaitingApproval);
    assert_eq!(p.provenance, Provenance::Untrusted);
    assert_eq!(v.get_config().balance, usdc(1_000));
    assert_eq!(v.get_awaiting_approval().len(), 1);
}

#[test]
fn p3_raw_address_is_sent_in_limits_only_mode() {
    let mut v = setup(Mode::LimitsOnly);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    expect_promise(v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(49), None));
    assert_eq!(v.get_payment(0).unwrap().status, PaymentStatus::Sending);
}

#[test]
fn p3_owner_approval_sends_and_rejection_closes() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(10), None);
    let _ = v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(11), None);

    call_as(owner(), ONE_YOCTO, MINUTE_NS);
    expect_promise(v.approve_payment(0));
    assert_eq!(v.get_payment(0).unwrap().status, PaymentStatus::Sending);
    let p = v.reject_payment(1, Some("Looks like invoice fraud".into()));
    assert_eq!(p.status, PaymentStatus::Rejected);
    assert!(v.get_awaiting_approval().is_empty());
}

#[test]
#[should_panic(expected = "Attach exactly 1 yoctoNEAR")]
fn approval_requires_full_access_key() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(10), None);
    call_as(owner(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.approve_payment(0);
}

#[test]
#[should_panic(expected = "Owner only")]
fn agent_cannot_approve_its_own_payment() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(10), None);
    call_as(agent(), ONE_YOCTO, MINUTE_NS);
    let _ = v.approve_payment(0);
}

#[test]
fn p2_unpinned_resolver_is_blocked() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(
        0,
        PayeeRef::Resolved { resolver: acc("evil-registry.testnet"), reference: "translate-hi".into() },
        usdc(30),
        None,
    ));
    assert_eq!(p.status, PaymentStatus::Blocked);
    assert!(p.reason.contains("not pinned"));
}

#[test]
fn p2_resolved_payee_is_sent_then_paid() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    expect_promise(v.request_payment(
        0,
        PayeeRef::Resolved { resolver: registry(), reference: "translate-hi".into() },
        usdc(30),
        None,
    ));
    assert_eq!(v.get_payment(0).unwrap().status, PaymentStatus::Resolving);
    assert_eq!(v.get_task(0).unwrap().reserved, usdc(30));

    call_as(vault(), NearToken::from_yoctonear(0), MINUTE_NS);
    let translator = acc("hindi-translator.testnet");
    expect_promise(v.on_resolved(
        0,
        usdc(30),
        Ok(Some(Resolution { payee: translator.clone(), amount: usdc(25) })),
    ));
    let p = v.get_payment(0).unwrap();
    assert_eq!(p.status, PaymentStatus::Sending);
    assert_eq!(p.payee, Some(translator.clone()));
    assert_eq!(p.amount, usdc(25));
    assert_eq!(v.get_task(0).unwrap().reserved, usdc(25));

    let p = v.on_transfer_complete(0, Ok(()));
    assert_eq!(p.status, PaymentStatus::Paid);
    assert_eq!(v.get_task(0).unwrap().spent, usdc(25));
    assert_eq!(v.get_payee_stats(translator).payments, 1);
}

#[test]
fn p2_price_above_ceiling_is_blocked() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(
        0,
        PayeeRef::Resolved { resolver: registry(), reference: "translate-hi".into() },
        usdc(20),
        None,
    );
    call_as(vault(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.on_resolved(
        0,
        usdc(20),
        Ok(Some(Resolution { payee: acc("hindi-translator.testnet"), amount: usdc(25) })),
    ));
    assert_eq!(p.status, PaymentStatus::Blocked);
    assert_eq!(v.get_task(0).unwrap().reserved, U128(0));
}

#[test]
fn p2_unknown_reference_is_blocked() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(
        0,
        PayeeRef::Resolved { resolver: registry(), reference: "vendor-payments".into() },
        usdc(49),
        None,
    );
    call_as(vault(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.on_resolved(0, usdc(49), Ok(None)));
    assert_eq!(p.status, PaymentStatus::Blocked);
    assert_eq!(v.get_task(0).unwrap().reserved, U128(0));
}

#[test]
#[should_panic(expected = "Only this task's agent")]
fn other_accounts_cannot_spend() {
    let mut v = setup(Mode::Lineage);
    call_as(attacker(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(0, PayeeRef::Signed { slot: 0 }, usdc(1), None);
}

#[test]
fn frozen_vault_blocks_everything() {
    let mut v = setup(Mode::LimitsOnly);
    call_as(owner(), NearToken::from_yoctonear(0), MINUTE_NS);
    v.freeze();
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(0, PayeeRef::Signed { slot: 0 }, usdc(1), None));
    assert_eq!(p.status, PaymentStatus::Blocked);
    assert!(p.reason.contains("frozen"));
}

#[test]
fn expired_mandate_blocks() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), 61 * MINUTE_NS);
    let p = value(v.request_payment(0, PayeeRef::Signed { slot: 0 }, usdc(1), None));
    assert_eq!(p.status, PaymentStatus::Blocked);
    assert!(p.reason.contains("expired"));
}

#[test]
fn per_payment_and_budget_limits_block() {
    let mut v = setup(Mode::LimitsOnly);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(51), None));
    assert!(p.reason.contains("per-payment limit"));
    let _ = v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(50), None);
    let _ = v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(50), None);
    let p = value(v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(1), None));
    assert!(p.reason.contains("Exceeds task budget"));
}

#[test]
fn failed_transfer_releases_budget_and_signed_cap() {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.request_payment(0, PayeeRef::Signed { slot: 0 }, usdc(20), None);
    call_as(vault(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = v.on_transfer_complete(0, Err(PromiseError::Failed));
    assert_eq!(p.status, PaymentStatus::Failed);
    let t = v.get_task(0).unwrap();
    assert_eq!(t.reserved, U128(0));
    assert_eq!(t.spent, U128(0));
    assert_eq!(t.signed_payees[0].committed, U128(0));
    assert_eq!(v.get_config().balance, usdc(1_000));
}

#[test]
#[should_panic(expected = "Only the configured token")]
fn deposits_only_from_configured_token() {
    let mut v = setup(Mode::Lineage);
    call_as(acc("fake-usdc.testnet"), NearToken::from_yoctonear(0), MINUTE_NS);
    let _ = v.ft_on_transfer(attacker(), usdc(1_000_000), String::new());
}

fn stored_memo(memo: &str) -> String {
    let mut v = setup(Mode::Lineage);
    call_as(agent(), NearToken::from_yoctonear(0), MINUTE_NS);
    let p = value(v.request_payment(0, PayeeRef::Raw { account_id: attacker() }, usdc(1), Some(memo.to_string())));
    assert_eq!(p.status, PaymentStatus::AwaitingApproval);
    v.get_payment(p.id).unwrap().memo
}

#[test]
fn memo_of_em_dashes_is_cut_on_a_char_boundary() {
    let input = "—".repeat(84);
    assert_eq!(input.len(), 252);
    let memo = stored_memo(&input);
    assert!(memo.len() <= 200);
    assert!(input.starts_with(&memo));
    assert_eq!(memo, "—".repeat(66));
}

#[test]
fn memo_with_boundary_at_200_keeps_200_bytes() {
    let memo = stored_memo(&format!("{}—tail", "a".repeat(200)));
    assert_eq!(memo, "a".repeat(200));
}

#[test]
fn short_memo_is_unchanged() {
    assert_eq!(stored_memo("Invoice A-102 — logo"), "Invoice A-102 — logo");
}
