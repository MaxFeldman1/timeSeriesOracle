module.exports = async function(callback) {

	const defaultAddress = "0x0000000000000000000000000000000000000000";

	try{
		const uniswapFactory = artifacts.require('./UniswapV2Factory.sol');
		const uniswapPair = artifacts.require('./UniswapV2Pair.sol');
		const uniswapERC20 = artifacts.require('./UniswapV2ERC20.sol');
		const token = artifacts.require('./token.sol');
		const oracle = artifacts.require('./oracle.sol');
		
		console.log("====>Loading Finished");

		accounts = await web3.eth.getAccounts();
		web3.eth.defaultAccount = accounts[0];

		factoryInstance = await uniswapFactory.new(accounts[0]);

		asset0 = await token.new(0);
		asset1 = await token.new(0);

		await factoryInstance.createPair(asset0.address, asset1.address);
		//get address
		pairInstance = await uniswapPair.at(await factoryInstance.getPair(asset0.address, asset1.address));

		oracleInstance = await oracle.new(pairInstance.address, asset1.address);

		subUnits = Math.pow(10, (await asset0.decimals()));
		//price will be defined as reservesAsset0/reservesAsset1
		targetPrice = 5;
		transferAmount = 1000*subUnits;

		asset0.transfer(pairInstance.address, transferAmount*targetPrice);
		asset1.transfer(pairInstance.address, transferAmount);
		await pairInstance.mint(web3.eth.defaultAccount);

		token0 = await pairInstance.token0();

		reserves = await pairInstance.getReserves();

		await oracleInstance.set();

		oraclePrice = (await oracleInstance.latestSpot()).toNumber() / (await oracleInstance.inflator()).toNumber();

		price = (token0 == asset0.address) ? reserves._reserve0 / reserves._reserve1 : reserves._reserve1 / reserves._reserve0;

		console.log(price);

		console.log(targetPrice);

		console.log(oraclePrice)

		console.log(price == targetPrice && price == oraclePrice);

		process.exit();
	} catch (err) {
		console.log(err);
		process.exit();
	}
	

}