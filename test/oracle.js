const token = artifacts.require("token");
const uniswapFactory = artifacts.require('UniswapV2Factory');
const uniswapPair = artifacts.require('UniswapV2Pair');
const oracle = artifacts.require("oracle");

const helper = require("../helper/helper.js");

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

		inflator = (await oracleInstance.inflator()).toNumber();

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
		var balance0 = await asset0.balanceOf(pairInstance.address);
		var balance1 = await asset1.balanceOf(pairInstance.address);
		asset0.transfer(pairInstance.address, Math.floor(subUnits*spot) - balance0);
		await asset1.transfer(pairInstance.address, subUnits - balance1);
		await pairInstance.mint(web3.eth.defaultAccount);
		await oracleInstance.set();
	}

	async function heightToPrevTs(height) {
		var index = (await oracleInstance.heightToIndex(height)).toNumber();
		var newHeight = (await oracleInstance.heights(index)).toNumber();
		return (await oracleInstance.timestamps(newHeight)).toNumber();
	}

	async function heightToPrevSpot(height) {
		var index = (await oracleInstance.heightToIndex(height)).toNumber();
		var newHeight = (await oracleInstance.heights(index)).toNumber();
		return (await oracleInstance.heightToSpot(newHeight)).toNumber();
	}

	async function tsToPrevSpot(time) {
		var index = (await oracleInstance.tsToIndex(time)).toNumber();
		var newHeight = (await oracleInstance.heights(index)).toNumber();
		return (await oracleInstance.heightToSpot(newHeight)).toNumber();
	}

	async function indexToSpot(index) {
		var height = (await oracleInstance.heights(index)).toNumber();
		return (await oracleInstance.heightToSpot(height)) / inflator;
	}

	//in solidity block.number is always height of the next block, in web3 it is height of prev block
	function getBlockNumber() {
		return web3.eth.getBlockNumber();
	}

	it('sets and fetches spot price', async () => {
		try{
			spot = 5
			secondSpot = 7;
			await setPrice(spot);
			blockSetSpot = await getBlockNumber();
			await helper.advanceTime(2);
			res = (await oracleInstance.latestSpot()) / inflator;
			assert.equal(res, spot, 'latestSpot() fetches current spot price');
			height = await getBlockNumber();
			res = (await heightToPrevSpot(height))/inflator;
			//res = (await heightToPrevSpot(height))/inflator;
			assert.equal(res, spot, "getUint(uint) fetches the latest spot price");
			await setPrice(secondSpot);
			blockSetSecondSpot = await getBlockNumber();
			await helper.advanceTime(2);
			//note that we have not updated the value of height yet
			res = (await heightToPrevSpot(height)) / inflator;
			assert.equal(res, spot, "getUint(uint) can fetch previous values");
			//we are now feching the price of the blocks after setting the spot a second time
			res = (await heightToPrevSpot(blockSetSecondSpot+5))/inflator;
			assert.equal(res, secondSpot, "getUint(uint) can fetch the most recent spot");
			res = (await heightToPrevSpot(height-3))/inflator;
			assert.equal(res, 0, "getUint(uint) returns 0 when there are no previous spot prices");
			res = await web3.eth.getBlock('latest');
			height = res.number;
			time = res.timestamp;
			result = (await heightToPrevSpot(height))/inflator;
			//res  = await oracleInstance.timestampBehindHeight(height);
			res  = await heightToPrevTs(height);
			assert.equal(res <= time, true, "returns the correct timestamp");
			await setPrice(1);
			blockSet1 = await getBlockNumber();
			await helper.advanceTime(2);
			await setPrice(5);
			blockSet5 = await getBlockNumber();
			await helper.advanceTime(2);
			await setPrice(6);
			blockSet6 = await getBlockNumber();
			res = await web3.eth.getBlock('latest');
			diff = res.timestamp-time;
			time = res.timestamp;
			height = res.number;
			res = (await tsToPrevSpot(time))/inflator;
			assert.equal(res, 6, "correct spot");
			newTime = (await web3.eth.getBlock(blockSet1)).timestamp+1;
			res = (await tsToPrevSpot(newTime))/inflator;
			assert.equal(res, 1, "correct spot");
			newTime = (await web3.eth.getBlock(blockSet5)).timestamp+1;
			res = (await tsToPrevSpot(newTime))/inflator;
			assert.equal(res, 5, "correct spot");
			newTime = (await web3.eth.getBlock(blockSetSpot)).timestamp;
			spotTime = newTime;
			res = (await tsToPrevSpot(newTime))/inflator;
			assert.equal(res, spot, "correct spot");
			newTime = (await web3.eth.getBlock(blockSetSecondSpot)).timestamp;
			res = (await tsToPrevSpot(newTime))/inflator;
			assert.equal(res, secondSpot, "correct spot");
			res = (await tsToPrevSpot(spotTime-4))/inflator;
			assert.equal(res, 0, "correct spot");
		} catch (err) {
			console.error(err.message);
			throw err;
		}

	});

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


	it('gets median', async () => {
		//set time in the future so that it will always be ahead of current time
		time = parseInt((new Date()).getTime()/1000)*2;
		await setPrice(1);
		await setPrice(2);
		await setPrice(10);
		var median = 2;
		var length = (await oracleInstance.heightsLength()).toNumber();
		assert.equal(await indexToSpot(length-1), 10, 'correct spot at last index');
		assert.equal(await indexToSpot(length-2), 2, 'correct spot at 2nd to last index');
		assert.equal(await indexToSpot(length-3), 1, 'correct spot at 3rd to last index');


		//last 3 elemets orderd by spot from 1=>smallest 2=>median 3=>largest [1, 2, 3]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [1, 2, 3]");
		await setPrice(6);
		median = 6;
		//last 3 elemets orderd by spot from 1=>smallest 2=>median 3=>largest [1, 3, 2]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [1, 3, 2]");
		await setPrice(3);
		median = 6;
		//last 3 elemets orderd by spot from 1=>smallest 2=>median 3=>largest [3, 2, 1]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [3, 2, 1]");
		await setPrice(4);
		median = 4;
		//last 3 elemets orderd by spot from 1=>smallest 2=>median 3=>largest [3, 1, 2]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [3, 1, 2]");
		await setPrice(2);
		median = 3;
		//last 3 elemets orderd by spot from 1=>smallest 2=>median 3=>largest [2, 3, 1]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [2, 3, 1]");
		await setPrice(6);
		median = 4;
		//last 3 elemets orderd by spot from 1=>smallest 2=>median 3=>largest [2, 1, 3]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [2, 1, 3]");

		//now test for when two of the last three elements have the same value
		await setPrice(2);
		median = 2;
		//last 3 elemets orderd by spot from 1=>smallest 2=>largest [1, 2, 1]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [1, 2, 1]");
		await setPrice(2);
		median = 2;
		//last 3 elemets orderd by spot from 1=>smallest 2=>largest [2, 1, 1]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [2, 1, 1]");
		await setPrice(3);
		median = 2;
		//last 3 elemets orderd by spot from 1=>smallest 2=>largest [1, 1, 2]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [1, 1, 2]");
		await setPrice(3);
		median = 3;
		//last 3 elemets orderd by spot from 1=>smallest 2=>largest [1, 2, 2]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [1, 2, 2]");
		await setPrice(2);
		median = 3;
		//last 3 elemets orderd by spot from 1=>smallest 2=>largest [2, 2, 1]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [2, 2, 1]");
		await setPrice(3);
		median = 3;
		//last 3 elemets orderd by spot from 1=>smallest 2=>largest [2, 1, 2]
		res = (await oracleInstance.fetchSpotAtTime(time))/inflator;
		assert.equal(res, median, "correct median of last 3 spots [2, 1, 2]");
	});

});
