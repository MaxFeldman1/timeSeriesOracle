pragma solidity >=0.5.0;
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/ITimeSeriesOracle.sol";

contract oracle is ITimeSeriesOracle {
    uint public latestSpot;

    //lists all block heights at which spot is collected
    uint[] public heights;
    function heightsLength() external view returns (uint length) {length = heights.length;}
    //height => timestamp
    mapping(uint => uint) public timestamps;
    //height => price
    mapping(uint => uint) public heightToSpot;


    uint startHeight;

    uint mostRecent;

    /*
        adds extra accuracy to spot price
        any contract interacting with this oracle shold divide out the inflator after calculatioins
        inflator shall be equal to scUnits *the amount of subUnits in one full unit of strikeAsset*
    */
    uint public inflator;

    address public uniswapV2PairAddress;
    address public strikeAssetAddress;
    bool token0Over1;

    constructor(address _uniswapV2PairAddress, address _strikeAssetAddress) public {
        uniswapV2PairAddress = _uniswapV2PairAddress;
        strikeAssetAddress = _strikeAssetAddress;
        inflator = 10 ** uint(IERC20(strikeAssetAddress).decimals());
        token0Over1 = strikeAssetAddress == IUniswapV2Pair(uniswapV2PairAddress).token1();
        startHeight = block.number;
        mostRecent = startHeight;
        heights.push(block.number);
        heights.push(block.number);
        heights.push(block.number);
        //set();
    }

    function set() public {
        //we don't let contracts set the spot because they can manipulate price without consequence
        require(msg.sender == tx.origin);
        (uint res0, uint res1, ) = IUniswapV2Pair(uniswapV2PairAddress).getReserves();
        latestSpot = token0Over1 ? inflator*res0/res1 : inflator*res1/res0;
        if (heights[heights.length-1] != block.number) heights.push(block.number);
        timestamps[block.number] = block.timestamp;
        heightToSpot[block.number] = latestSpot;
        mostRecent = startHeight;
    }
    
    function tsToIndex(uint _time) public view returns (uint) {
        uint size = heights.length;
        if (_time >= timestamps[heights[size-1]]) return size-1;
        if (_time < timestamps[heights[0]] || size < 3) return 0;
        uint step = size>>2;
        for (uint i = size>>1; ;step = step > 1? step>>1: 1){
            uint currentTs = timestamps[heights[i]];
            uint nextTs = i+1 < size ? timestamps[heights[i+1]]: timestamps[heights[size-1]];
            /*
                c => currentTs
                n => nextTs
                Target => _time
                    On each iteration find where Target is in relation to others
                c, n, Target => increace i
                c, Target, n => c
                Target, c, n => decreace i
            */
            if (_time >= nextTs)
                i = (i+step) < size ? i+step : size-1;                
            else if (_time >= currentTs)
                return i;
            else
                i = i > step ? i-step : 0;
        }

    }

    function heightToIndex(uint _height) public view returns (uint) {
        uint size = heights.length;
        if (_height >= heights[size-1]) return size-1;
        if (_height <= heights[0] || size == 3) return 0;
        uint step = size>>2;
        for (uint i = size>>1; ;step = step > 1? step>>1: 1){
            uint currentHeight = heights[i];
            uint nextHeight = i+1 < size ? heights[i+1]: heights[size-1];
            /*
                c => currentTs
                n => nextTs
                Target => _time
                    On each iteration find where Target is in relation to others
                c, n, Target => increace i
                c, Target, n => c
                Target, c, n => decreace i
            */
            if (_height > nextHeight)
                i = (i+step) < size ? i+step : size-1;
            else if (_height == nextHeight)
                return i+1 < size ? i+1 : size-1;
            else if (_height >= currentHeight)
                return i;
            else
                i = i > step ? i-step : 0;
        }

    }

    function medianPreviousIndecies(uint _index) public view returns (uint median) {
        require(_index > 1, "index must be 2 or greater");
        require(_index < heights.length, "index must be in array");
        uint first = heightToSpot[heights[_index-2]];
        uint second = heightToSpot[heights[_index-1]];
        uint third = heightToSpot[heights[_index]];
        (first,second) = first > second ? (first, second) : (second,first);
        (second,third) = second > third ? (second, third) : (third,second);
        (first,second) = first > second ? (first, second) : (second,first);
        median = second;
    }

    function fetchSpotAtTime(uint _time) external view returns (uint) {
        return medianPreviousIndecies(tsToIndex(_time));
    }

}