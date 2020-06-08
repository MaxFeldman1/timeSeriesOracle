const token = artifacts.require("./token.sol");
const uniswapFactory = artifacts.require('./UniswapV2Factory.sol');
const uniswapPair = artifacts.require('./UniswapV2Pair.sol');
const uniswapERC20 = artifacts.require('./UniswapV2ERC20.sol');
const oracle = artifacts.require("./oracle.sol");

contract('oracle', async function(accounts) {

	web3.eth.defaultAccount = accounts[0];

	it('before each', async() => {
		try {
		factoryInstance = await uniswapFactory.new(web3.eth.defaultAccount);

		asset0 = await token.new(0);
		asset1 = await token.new(0);

		await factoryInstance.createPair(asset0.address, asset1.address);

		pairInstance = await uniswapPair.at(await factoryInstance.getPair(asset0.address, asset1.address));

		oracleInstance = await oracle.new(pairInstance.address, asset1.address);

		subUnits = Math.pow(10, (await asset0.decimals()));

		} catch (err) {
			console.error(err.message);
			throw(err);
		}

	});

	async function setPrice(spot) {
		var liquidityBalance = (await pairInstance.balanceOf(web3.eth.defaultAccount)).toNumber();
		if (liquidityBalance > 0) {
			pairInstance.transfer(pairInstance.address, liquidityBalance);
			await pairInstance.burn(web3.eth.defaultAccount);
		}
		asset0.transfer(pairInstance.address, Math.floor(subUnits*spot));
		asset1.transfer(pairInstance.address, subUnits);
		await pairInstance.mint(web3.eth.defaultAccount);
		await oracleInstance.set();
	}

	it('sets / reads price correctly from uniswap', async() => {
		try {
		var targetPrice = 5;
		await setPrice(targetPrice);
		var reserves = await pairInstance.getReserves();
		var oraclePrice = (await oracleInstance.latestSpot()).toNumber() / (await oracleInstance.inflator()).toNumber();
		assert.equal(oraclePrice, targetPrice, "oracle correctly sets price");
		} catch (err) {
			console.log(err.message);
			throw(err);
		}
	});


	//it('gets median pri')
});