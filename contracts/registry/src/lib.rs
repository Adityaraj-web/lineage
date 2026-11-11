use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::IterableMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault};

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum ServiceStatus {
    Pending,
    Verified,
    Revoked,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Service {
    pub id: String,
    pub payee: AccountId,
    pub price: U128,
    pub description: String,
    pub status: ServiceStatus,
    pub updated_at_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Resolution {
    pub payee: AccountId,
    pub amount: U128,
}

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Services,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct LineageRegistry {
    curator: AccountId,
    services: IterableMap<String, Service>,
}

#[near]
impl LineageRegistry {
    #[init]
    pub fn new(curator: AccountId) -> Self {
        Self {
            curator,
            services: IterableMap::new(StorageKey::Services),
        }
    }

    pub fn apply(&mut self, id: String, price: U128, description: String) -> Service {
        require!(!id.is_empty() && id.len() <= 64, "Service id must be 1-64 chars");
        require!(price.0 > 0, "Price must be positive");
        let payee = env::predecessor_account_id();
        if let Some(existing) = self.services.get(&id) {
            require!(existing.payee == payee, "Service id is owned by another account");
        }
        let service = Service {
            id: id.clone(),
            payee,
            price,
            description,
            status: ServiceStatus::Pending,
            updated_at_ms: env::block_timestamp_ms(),
        };
        self.services.insert(id, service.clone());
        self.emit("service_applied", &service);
        service
    }

    pub fn verify(&mut self, id: String) -> Service {
        self.set_status(id, ServiceStatus::Verified)
    }

    pub fn revoke(&mut self, id: String) -> Service {
        self.set_status(id, ServiceStatus::Revoked)
    }

    pub fn lineage_resolve(&self, reference: String) -> Option<Resolution> {
        self.services
            .get(&reference)
            .filter(|s| s.status == ServiceStatus::Verified)
            .map(|s| Resolution { payee: s.payee.clone(), amount: s.price })
    }

    pub fn get_service(&self, id: String) -> Option<Service> {
        self.services.get(&id).cloned()
    }

    pub fn list_services(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<Service> {
        self.services
            .values()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50) as usize)
            .cloned()
            .collect()
    }

    pub fn get_curator(&self) -> AccountId {
        self.curator.clone()
    }

    fn set_status(&mut self, id: String, status: ServiceStatus) -> Service {
        require!(env::predecessor_account_id() == self.curator, "Curator only");
        let service = self.services.get_mut(&id).expect("No such service");
        service.status = status;
        service.updated_at_ms = env::block_timestamp_ms();
        let snapshot = service.clone();
        self.emit("service_status", &snapshot);
        snapshot
    }

    fn emit(&self, event: &str, service: &Service) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({ "standard": "lineage-registry", "version": "1.0.0", "event": event, "data": [service] })
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    fn as_(who: &str) {
        testing_env!(VMContextBuilder::new()
            .current_account_id(acc("registry.lineage.testnet"))
            .predecessor_account_id(acc(who))
            .build());
    }

    #[test]
    fn only_verified_services_resolve() {
        as_("curator.testnet");
        let mut r = LineageRegistry::new(acc("curator.testnet"));
        as_("hindi-translator.testnet");
        r.apply("translate-hi".into(), U128(25_000_000), "EN->HI translation".into());
        assert!(r.lineage_resolve("translate-hi".into()).is_none());

        as_("curator.testnet");
        r.verify("translate-hi".into());
        let res = r.lineage_resolve("translate-hi".into()).unwrap();
        assert_eq!(res.payee, acc("hindi-translator.testnet"));
        assert_eq!(res.amount, U128(25_000_000));

        r.revoke("translate-hi".into());
        assert!(r.lineage_resolve("translate-hi".into()).is_none());
    }

    #[test]
    fn changing_price_requires_reverification() {
        as_("curator.testnet");
        let mut r = LineageRegistry::new(acc("curator.testnet"));
        as_("hindi-translator.testnet");
        r.apply("translate-hi".into(), U128(25), "x".into());
        as_("curator.testnet");
        r.verify("translate-hi".into());
        as_("hindi-translator.testnet");
        r.apply("translate-hi".into(), U128(2_500), "x".into());
        assert!(r.lineage_resolve("translate-hi".into()).is_none());
    }

    #[test]
    #[should_panic(expected = "owned by another account")]
    fn nobody_can_hijack_a_service_id() {
        as_("curator.testnet");
        let mut r = LineageRegistry::new(acc("curator.testnet"));
        as_("hindi-translator.testnet");
        r.apply("translate-hi".into(), U128(25), "x".into());
        as_("vendor-payments.testnet");
        r.apply("translate-hi".into(), U128(25), "x".into());
    }

    #[test]
    #[should_panic(expected = "Curator only")]
    fn only_curator_verifies() {
        as_("curator.testnet");
        let mut r = LineageRegistry::new(acc("curator.testnet"));
        as_("vendor-payments.testnet");
        r.apply("pay-me".into(), U128(49), "x".into());
        r.verify("pay-me".into());
    }
}
