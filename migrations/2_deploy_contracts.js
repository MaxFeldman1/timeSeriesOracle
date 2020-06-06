const token = artifacts.require("token");
const factory = artifacts.require("UniswapV2Factory");
const oracle = artifacts.require("oracle");

module.exports = function(deployer) {
	return web3.eth.getAccounts().then((res) => {
		web3.eth.defaultAccount = res[0];
		return deployer.deploy(token, 0);
	}).then((res) => {
		asset0 = res;
		return deployer.deploy(token, 0);
	}).then((res) => {
		asset1 = res;
		return deployer.deploy(factory, web3.eth.defaultAccount);
	}).then((res) => {
		factoryInstance = res;
		return factoryInstance.createPair(asset0.address, asset1.address);
	}).then(() => {
		return factoryInstance.getPair(asset0.address, asset1.address);
	}).then((res) => {
		pairAddress = res;
		return deployer.deploy(oracle, res, asset1.address);
	});
}
