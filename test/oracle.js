const token = artifacts.require("./token.sol");
const uniswapFactory = artifacts.require('./UniswapV2Factory.sol');
const uniswapPair = artifacts.require('./UniswapV2Pair.sol');
const uniswapERC20 = artifacts.require('./UniswapV2ERC20.sol');
const oracle = artifacts.require("./oracle.sol");

contract('oracle', async function(accounts) {

	web3.eth.defaultAccount = accounts[0];

	it('before each', async() => {
		factoryInstance = await uniswapFactory.new(web3.eth.defaultAccount);

		asset0 = await token.new(0);
		asset1 = await token.new(0);

		await factoryInstance.createPair(asset0.address, asset1.address);

		pairInstance = await uniswapPair.at(await factoryInstance.getPair(asset0.address, asset1.address));

		oracleInstance = await oracle.new(pairInstance.address, asset1.address);

		subUnits = Math.pow(10, (await asset0.decimals()));


	});

	it('sets / reads price correctly from uniswap', async() => {
		targetPrice = 5;
		transferAmount = 1000*subUnits;

		asset0.transfer(pairInstance.address, transferAmount*targetPrice);
		asset1.transfer(pairInstance.address, transferAmount);
		await pairInstance.mint(web3.eth.defaultAccount);
		token0 = await pairInstance.token0();
		reserves = await pairInstance.getReserves();
		await oracleInstance.set();
		oraclePrice = (await oracleInstance.latestSpot()).toNumber() / (await oracleInstance.inflator()).toNumber();
		assert.equal(oraclePrice, targetPrice, "oracle correctly sets price");
	});

});