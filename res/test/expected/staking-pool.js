// ----------------------------------------------
// Transpiled by rs2as - source: ./res/test/staking-pool/src/lib.rs
// ---------------------------------------------
import { Context, logging, storage } from "near-sdk-as".js
// mod internal
/// The amount of gas given to complete `vote` call.
const VOTE_GAS: u64  = 100_000_000_000_000
/// The amount of gas given to complete internal `on_stake_action` call.
const ON_STAKE_ACTION_GAS: u64  = 20_000_000_000_000
/// The amount of yocto NEAR the contract dedicates to guarantee that the "share" price never
/// decreases. It's used during rounding errors for share -> amount conversions.
const STAKE_SHARE_PRICE_GUARANTEE_FUND: Balance  = 1_000_000_000_000
/// There is no deposit balance attached.
const NO_DEPOSIT: Balance  = 0
/// A type to distinguish between a balance and "stake" shares for better readability.
type NumStakeShares  = Balance
construct_uint!{/// 256-bit unsigned integer.pubstructU256(4);}
//#[cfg(test)]
// mod test_utils
//#[global_allocator]
/// Inner account data of a delegate.
//#[derive(BorshDeserialize, BorshSerialize, Debug, PartialEq)]
// declare struct Account
/// Represents an account structure readable by humans.
//#[derive(Serialize, Deserialize)]
//#[serde(crate = "near_sdk::serde")]
// declare struct HumanReadableAccount
// impl Default
function default(): Self {
    return {        unstaked : 0,
        stake_shares : 0,
        unstaked_available_epoch_height : 0} as Self
}
/// The number of epochs required for the locked balance to become unlocked.
/// NOTE: The actual number of epochs when the funds are unlocked is 3. But there is a corner case
/// when the unstaking promise can arrive at the next epoch, while the inner state is already
/// updated in the previous epoch. It will not unlock the funds for 4 epochs.
const NUM_EPOCHS_TO_UNLOCK: EpochHeight  = 4
//#[near_bindgen]
//#[derive(BorshDeserialize, BorshSerialize)]
// declare struct StakingContract
// impl Default
function default(): Self {
    return env.panic(b"Staking contract should be initialized before usage")
}
//#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
//#[serde(crate = "near_sdk::serde")]
// declare struct RewardFeeFraction
// impl RewardFeeFraction
export function assert_valid() {
    assert_ne!(this.denominator,0,"Denominator must be a positive number")
    assert(this.numerator<=this.denominator,"The reward fee must be less or equal to 1")
}
export function multiply(value: Balance): Balance {
    return (U256.from(this.numerator) * U256.from(value) / U256.from(this.denominator))
}
/// Interface for a voting contract.
//#[ext_contract(ext_voting)]
VoteContract/// Method for validators to vote or withdraw the vote.
/// Votes for if `is_vote` is true, or withdraws the vote if `is_vote` is false.
function vote(is_vote: bool)
/// Interface for the contract itself.
//#[ext_contract(ext_self)]
SelfContract/// A callback to check the result of the staking action.
/// In case the stake amount is less than the minimum staking threshold, the staking action
/// fails, and the stake amount is not changed. This might lead to inconsistent state and the
/// follow withdraw calls might fail. To mitigate this, the contract will issue a new unstaking
/// action in case of the failure of the first staking action.
function on_stake_action()
//#[near_bindgen]
// impl StakingContract
/// Initializes the contract with the given owner_id, initial staking public key (with ED25519
/// curve) and initial reward fee fraction that owner charges for the validation work.
///
/// The entire current balance of this contract will be used to stake. This allows contract to
/// always maintain staking shares that can't be unstaked or withdrawn.
/// It prevents inflating the price of the share too much.
//#[init]
export function new(owner_id: AccountId, stake_public_key: Base58PublicKey, reward_fee_fraction: RewardFeeFraction): Self {
    assert(!env::state_exists(),"Already initialized")
    reward_fee_fraction.assert_valid()
    assert(env::is_valid_account_id(owner_id.as_bytes()),"The owner account ID is invalid")
    let account_balance = Context.env.account_balance()
    let total_staked_balance = account_balance - STAKE_SHARE_PRICE_GUARANTEE_FUND
    assert(env.account_locked_balance() == 0) //"The staking pool shouldn't be staking at the initialization"
    let this = {        [positional] : owner_id,
        stake_public_key : stake_public_key.into(),
        last_epoch_height : env.epoch_height(),
        last_total_balance : account_balance,
        [positional] : total_staked_balance,
        total_stake_shares : NumStakeShares.from(total_staked_balance),
        [positional] : reward_fee_fraction,
        accounts : UnorderedMap.new(b"u"),
        paused : false} as Self
    // Staking with the current pool to make sure the staking key is valid.
    this.internal_restake()
    return this
}
/// Distributes rewards and restakes if needed.
export function ping() {
    if (this.internal_ping()){
        this.internal_restake()
    }
}
/// Deposits the attached amount into the inner account of the predecessor.
//#[payable]
export function deposit() {
    let need_to_restake = this.internal_ping()
    this.internal_deposit()
    if (need_to_restake){
        this.internal_restake()
    }
}
/// Deposits the attached amount into the inner account of the predecessor and stakes it.
//#[payable]
export function deposit_and_stake() {
    this.internal_ping()
    let amount = this.internal_deposit()
    this.internal_stake(amount)
    this.internal_restake()
}
/// Withdraws the entire unstaked balance from the predecessor account.
/// It's only allowed if the `unstake` action was not performed in the four most recent epochs.
export function withdraw_all() {
    let need_to_restake = this.internal_ping()
    let account_id = Context.env.predecessor_account_id()
    let account = this.internal_get_account(account_id)
    this.internal_withdraw(account.unstaked)
    if (need_to_restake){
        this.internal_restake()
    }
}
/// Withdraws the non staked balance for given account.
/// It's only allowed if the `unstake` action was not performed in the four most recent epochs.
export function withdraw(amount: U128) {
    let need_to_restake = this.internal_ping()
    let amount: Balance = amount.into()
    this.internal_withdraw(amount)
    if (need_to_restake){
        this.internal_restake()
    }
}
/// Stakes all available unstaked balance from the inner account of the predecessor.
export function stake_all() {
    // Stake action always restakes
    this.internal_ping()
    let account_id = Context.env.predecessor_account_id()
    let account = this.internal_get_account(account_id)
    this.internal_stake(account.unstaked)
    this.internal_restake()
}
/// Stakes the given amount from the inner account of the predecessor.
/// The inner account should have enough unstaked balance.
export function stake(amount: U128) {
    // Stake action always restakes
    this.internal_ping()
    let amount: Balance = amount.into()
    this.internal_stake(amount)
    this.internal_restake()
}
/// Unstakes all staked balance from the inner account of the predecessor.
/// The new total unstaked balance will be available for withdrawal in four epochs.
export function unstake_all() {
    // Unstake action always restakes
    this.internal_ping()
    let account_id = Context.env.predecessor_account_id()
    let account = this.internal_get_account(account_id)
    let amount = this.staked_amount_from_num_shares_rounded_down(account.stake_shares)
    this.inner_unstake(amount)
    this.internal_restake()
}
/// Unstakes the given amount from the inner account of the predecessor.
/// The inner account should have enough staked balance.
/// The new total unstaked balance will be available for withdrawal in four epochs.
export function unstake(amount: U128) {
    // Unstake action always restakes
    this.internal_ping()
    let amount: Balance = amount.into()
    this.inner_unstake(amount)
    this.internal_restake()
}
/****************/
/* View methods */
/****************/
/// Returns the unstaked balance of the given account.
export function get_account_unstaked_balance(account_id: AccountId): U128 {
    return this.get_account(account_id).unstaked_balance
}
/// Returns the staked balance of the given account.
/// NOTE: This is computed from the amount of "stake" shares the given account has and the
/// current amount of total staked balance and total stake shares on the account.
export function get_account_staked_balance(account_id: AccountId): U128 {
    return this.get_account(account_id).staked_balance
}
/// Returns the total balance of the given account (including staked and unstaked balances).
export function get_account_total_balance(account_id: AccountId): U128 {
    let account = this.get_account(account_id)
    return (account.unstaked_balance.. + account.staked_balance..)
}
/// Returns `true` if the given account can withdraw tokens in the current epoch.
export function is_account_unstaked_balance_available(account_id: AccountId): bool {
    return this.get_account(account_id).can_withdraw
}
/// Returns the total staking balance.
export function get_total_staked_balance(): U128 {
    return this.total_staked_balance.into()
}
/// Returns account ID of the staking pool owner.
export function get_owner_id(): AccountId {
    return this.owner_id.clone()
}
/// Returns the current reward fee as a fraction.
export function get_reward_fee_fraction(): RewardFeeFraction {
    return this.reward_fee_fraction.clone()
}
/// Returns the staking public key
export function get_staking_key(): Base58PublicKey {
    return this.stake_public_key.clone().try_into().unwrap()
}
/// Returns true if the staking is paused
export function is_staking_paused(): bool {
    return this.paused
}
/// Returns human readable representation of the account for the given account ID.
export function get_account(account_id: AccountId): HumanReadableAccount {
    let account = this.internal_get_account(account_id)
    return {        [positional] : account_id,
        unstaked_balance : account.unstaked.into(),
        staked_balance : this.staked_amount_from_num_shares_rounded_down(account.stake_shares).into(),
        can_withdraw : account.unstaked_available_epoch_height <= env.epoch_height()} as HumanReadableAccount
}
/// Returns the number of accounts that have positive balance on this staking pool.
export function get_number_of_accounts(): u64 {
    return this.accounts.len()
}
/// Returns the list of accounts
export function get_accounts(from_index: u64, limit: u64): Vec {
    let keys = this.accounts.keys_as_vector()
    return (from_index .. std.cmp::min(from_index + limit, keys.len()))
}
/*************/
/* Callbacks */
/*************/
export function on_stake_action() {
    assert(env.current_account_id() == env.predecessor_account_id()) //"Can be called only as a callback"
    assert(env.promise_results_count() == 1) //"Contract expected a result on the callback"
    let stake_action_succeeded = const value=env.promise_result(0)
    value==PromiseResult.Successful(undefined)? true : value==false
    // If the stake action failed and the current locked amount is positive, then the contract
    // has to unstake.
    if ( ! stake_action_succeeded && env.account_locked_balance() > 0){
        Promise.new(env.current_account_id()).stake(0, this.stake_public_key.clone())
    }
}
/*******************/
/* Owner's methods */
/*******************/
/// Owner's method.
/// Updates current public key to the new given public key.
export function update_staking_key(stake_public_key: Base58PublicKey) {
    this.assert_owner()
    // When updating the staking key, the contract has to restake.
    let _need_to_restake = this.internal_ping()
    this.stake_public_key = stake_public_key.into()
    this.internal_restake()
}
/// Owner's method.
/// Updates current reward fee fraction to the new given fraction.
export function update_reward_fee_fraction(reward_fee_fraction: RewardFeeFraction) {
    this.assert_owner()
    reward_fee_fraction.assert_valid()
    let need_to_restake = this.internal_ping()
    this.reward_fee_fraction = reward_fee_fraction
    if (need_to_restake){
        this.internal_restake()
    }
}
/// Owner's method.
/// Calls `vote(is_vote)` on the given voting contract account ID on behalf of the pool.
export function vote(voting_account_id: AccountId, is_vote: bool): Promise {
    this.assert_owner()
    assert(env::is_valid_account_id(voting_account_id.as_bytes()),"Invalid voting account ID")
    return ext_voting.vote(is_vote, voting_account_id, NO_DEPOSIT, VOTE_GAS)
}
/// Owner's method.
/// Pauses pool staking.
export function pause_staking() {
    this.assert_owner()
    assert(!this.paused,"The staking is already paused")
    this.internal_ping()
    this.paused = true
    Promise.new(env.current_account_id()).stake(0, this.stake_public_key.clone())
}
/// Owner's method.
/// Resumes pool staking.
export function resume_staking() {
    this.assert_owner()
    assert(this.paused,"The staking is not paused")
    this.internal_ping()
    this.paused = false
    this.internal_restake()
}
//#[cfg(test)]
// mod tests
// declare struct Emulator
function zero_fee(): RewardFeeFraction {
    return {        numerator : 0,
        denominator : 1} as RewardFeeFraction
}
// impl Emulator
export function new(owner: String, stake_public_key: String, reward_fee_fraction: RewardFeeFraction): Self {
    let context = VMContextBuilder.new().current_account_id(owner.clone()).account_balance(ntoy(30)).finish()
    testing_env!(context.clone())
    let contract = StakingContract.new(owner, Base58PublicKey.try_from(stake_public_key).unwrap(), reward_fee_fraction)
    let last_total_staked_balance = contract.total_staked_balance
    let last_total_stake_shares = contract.total_stake_shares
    return {        [positional] : contract,
        epoch_height : 0,
        amount : ntoy(30),
        locked_amount : 0,
        [positional] : last_total_staked_balance,
        [positional] : last_total_stake_shares,
        [positional] : context} as Emulator
}
function verify_stake_price_increase_guarantee() {
    let total_staked_balance = this.contract.total_staked_balance
    let total_stake_shares = this.contract.total_stake_shares
    assert(U256::from(total_staked_balance)*U256::from(this.last_total_stake_shares)>=U256::from(this.last_total_staked_balance)*U256::from(total_stake_shares),"Price increase guarantee was violated.")
    this.last_total_staked_balance = total_staked_balance
    this.last_total_stake_shares = total_stake_shares
}
export function update_context(predecessor_account_id: String, deposit: Balance) {
    this.verify_stake_price_increase_guarantee()
    this.context = VMContextBuilder.new().current_account_id(staking()).predecessor_account_id(predecessor_account_id.clone()).signer_account_id(predecessor_account_id).attached_deposit(deposit).account_balance(this.amount).account_locked_balance(this.locked_amount).epoch_height(this.epoch_height).finish()
    testing_env!(this.context.clone())
    console.log("Epoch: " + self.epoch_height.toString() + ", Deposit: " + deposit.toString() + ", amount: " + self.amount.toString() + ", locked_amount: " + self.locked_amount.toString())
}
export function simulate_stake_call() {
    let total_stake = this.contract.total_staked_balance
    // Stake action
    this.amount = this.amount + this.locked_amount - total_stake
    this.locked_amount = total_stake
    // Second function call action
    this.update_context(staking(), 0)
}
export function skip_epochs(num: EpochHeight) {
    this.epoch_height += num
    this.locked_amount = (this.locked_amount * (100 + u128.from(num))) / 100
}
//#[test]
function test_restake_fail() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    emulator.update_context(bob(), 0)
    emulator.contract.internal_restake()
    let receipts = Context.env.created_receipts()
    assert(receipts.len() == 2)
    // Mocked Receipt fields are private, so can't check directly.
    assert(serde_json::to_string(&receipts[0]).unwrap().contains("\"actions\":[{\"Stake\":{\"stake\":29999999999999000000000000,"))
    assert(serde_json::to_string(&receipts[1]).unwrap().contains("\"method_name\":\"on_stake_action\""))
    emulator.simulate_stake_call()
    emulator.update_context(staking(), 0)
    testing_env_with_promise_results(emulator.context.clone(), PromiseResult.Failed)
    emulator.contract.on_stake_action()
    let receipts = Context.env.created_receipts()
    assert(receipts.len() == 1)
    assert(serde_json::to_string(&receipts[0]).unwrap().contains("\"actions\":[{\"Stake\":{\"stake\":0,"))
}
//#[test]
function test_deposit_withdraw() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    let deposit_amount = ntoy(1_000_000)
    emulator.update_context(bob(), deposit_amount)
    emulator.contract.deposit()
    emulator.amount += deposit_amount
    emulator.update_context(bob(), 0)
    assert(emulator.contract.get_account_unstaked_balance(bob()).. == deposit_amount)
    emulator.contract.withdraw(deposit_amount.into())
    assert(emulator.contract.get_account_unstaked_balance(bob()).. == 0u128)
}
//#[test]
function test_stake_with_fee() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", {        numerator : 10,
        denominator : 100} as RewardFeeFraction)
    let deposit_amount = ntoy(1_000_000)
    emulator.update_context(bob(), deposit_amount)
    emulator.contract.deposit()
    emulator.amount += deposit_amount
    emulator.update_context(bob(), 0)
    emulator.contract.stake(deposit_amount.into())
    emulator.simulate_stake_call()
    assert(emulator.contract.get_account_staked_balance(bob()).. == deposit_amount)
    let locked_amount = emulator.locked_amount
    let n_locked_amount = yton(locked_amount)
    emulator.skip_epochs(10)
    // Overriding rewards (+ 100K reward)
    emulator.locked_amount = locked_amount + ntoy(100_000)
    emulator.update_context(bob(), 0)
    emulator.contract.ping()
    let expected_amount = deposit_amount + ntoy((yton(deposit_amount) * 90_000 + n_locked_amount / 2) / n_locked_amount)
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,expected_amount)
    // Owner got 10% of the rewards
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(owner()).0,ntoy(10_000))
    let locked_amount = emulator.locked_amount
    let n_locked_amount = yton(locked_amount)
    emulator.skip_epochs(10)
    // Overriding rewards (another 100K reward)
    emulator.locked_amount = locked_amount + ntoy(100_000)
    emulator.update_context(bob(), 0)
    emulator.contract.ping()
    // previous balance plus (1_090_000 / 1_100_030)% of the 90_000 reward (rounding to nearest).
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,expected_amount+ntoy((yton(expected_amount)*90_000+n_locked_amount/2)/n_locked_amount))
    // owner earns 10% with the fee and also small percentage from restaking.
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(owner()).0,ntoy(10_000)+ntoy(10_000)+ntoy((10_000u128*90_000+n_locked_amount/2)/n_locked_amount))
    assert(emulator.contract.get_number_of_accounts() == 2)
}
//#[test]
function test_stake_unstake() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    let deposit_amount = ntoy(1_000_000)
    emulator.update_context(bob(), deposit_amount)
    emulator.contract.deposit()
    emulator.amount += deposit_amount
    emulator.update_context(bob(), 0)
    emulator.contract.stake(deposit_amount.into())
    emulator.simulate_stake_call()
    assert(emulator.contract.get_account_staked_balance(bob()).. == deposit_amount)
    let locked_amount = emulator.locked_amount
    // 10 epochs later, unstake half of the money.
    emulator.skip_epochs(10)
    // Overriding rewards
    emulator.locked_amount = locked_amount + ntoy(10)
    emulator.update_context(bob(), 0)
    emulator.contract.ping()
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,deposit_amount+ntoy(10))
    emulator.contract.unstake((deposit_amount / 2))
    emulator.simulate_stake_call()
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,deposit_amount/2+ntoy(10))
    assert_eq_in_near!(emulator.contract.get_account_unstaked_balance(bob()).0,deposit_amount/2)
    let acc = emulator.contract.get_account(bob())
    assert(acc.account_id == bob())
    assert_eq_in_near!(acc.unstaked_balance.0,deposit_amount/2)
    assert_eq_in_near!(acc.staked_balance.0,deposit_amount/2+ntoy(10))
    assert(!acc.can_withdraw)
    assert(!emulator.contract.is_account_unstaked_balance_available(bob()),)
    emulator.skip_epochs(4)
    emulator.update_context(bob(), 0)
    assert(emulator.contract.is_account_unstaked_balance_available(bob()),)
}
//#[test]
function test_stake_all_unstake_all() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    let deposit_amount = ntoy(1_000_000)
    emulator.update_context(bob(), deposit_amount)
    emulator.contract.deposit_and_stake()
    emulator.amount += deposit_amount
    emulator.simulate_stake_call()
    assert(emulator.contract.get_account_staked_balance(bob()).. == deposit_amount)
    assert_eq_in_near!(emulator.contract.get_account_unstaked_balance(bob()).0,0)
    let locked_amount = emulator.locked_amount
    // 10 epochs later, unstake all.
    emulator.skip_epochs(10)
    // Overriding rewards
    emulator.locked_amount = locked_amount + ntoy(10)
    emulator.update_context(bob(), 0)
    emulator.contract.ping()
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,deposit_amount+ntoy(10))
    emulator.contract.unstake_all()
    emulator.simulate_stake_call()
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,0)
    assert_eq_in_near!(emulator.contract.get_account_unstaked_balance(bob()).0,deposit_amount+ntoy(10))
}
/// Test that two can delegate and then undelegate their funds and rewards at different time.
//#[test]
function test_two_delegates() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    emulator.update_context(alice(), ntoy(1_000_000))
    emulator.contract.deposit()
    emulator.amount += ntoy(1_000_000)
    emulator.update_context(alice(), 0)
    emulator.contract.stake(ntoy(1_000_000).into())
    emulator.simulate_stake_call()
    emulator.skip_epochs(3)
    emulator.update_context(bob(), ntoy(1_000_000))
    emulator.contract.deposit()
    emulator.amount += ntoy(1_000_000)
    emulator.update_context(bob(), 0)
    emulator.contract.stake(ntoy(1_000_000).into())
    emulator.simulate_stake_call()
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,ntoy(1_000_000))
    emulator.skip_epochs(3)
    emulator.update_context(alice(), 0)
    emulator.contract.ping()
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(alice()).0,ntoy(1_060_900)-1)
    assert_eq_in_near!(emulator.contract.get_account_staked_balance(bob()).0,ntoy(1_030_000))
    // Checking accounts view methods
    // Should be 2, because the pool has 0 fee.
    assert(emulator.contract.get_number_of_accounts() == 2)
    let accounts = emulator.contract.get_accounts(0, 10)
    assert(accounts.len() == 2)
    assert(accounts[0].account_id == alice())
    assert(accounts[1].account_id == bob())
    let accounts = emulator.contract.get_accounts(1, 10)
    assert(accounts.len() == 1)
    assert(accounts[0].account_id == bob())
    let accounts = emulator.contract.get_accounts(0, 1)
    assert(accounts.len() == 1)
    assert(accounts[0].account_id == alice())
    let accounts = emulator.contract.get_accounts(2, 10)
    assert(accounts.len() == 0)
}
//#[test]
function test_low_balances() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    let initial_balance = 100
    emulator.update_context(alice(), initial_balance)
    emulator.contract.deposit()
    emulator.amount += initial_balance
    let remaining = initial_balance
    let amount = 1
    whileemulator.update_context(alice(), 0)amount = 2 + (amount - 1) % 3emulator.contract.stake(amount.into())emulator.simulate_stake_call()remaining -= amount
}
//#[test]
function test_rewards() {
    let emulator = Emulator.new(owner(), "KuTCtARNzxZQ3YvXDeLjx83FDqxv2SdQTSbiq876zR7", zero_fee())
    let initial_balance = ntoy(100)
    emulator.update_context(alice(), initial_balance)
    emulator.contract.deposit()
    emulator.amount += initial_balance
    let remaining = 100
    let amount = 1
    whileemulator.skip_epochs(3)emulator.update_context(alice(), 0)emulator.contract.ping()emulator.update_context(alice(), 0)amount = 2 + (amount - 1) % 3emulator.contract.stake(ntoy(amount).into())emulator.simulate_stake_call()remaining -= amount
}
