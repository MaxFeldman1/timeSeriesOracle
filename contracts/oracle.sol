pragma solidity >=0.5.12;
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IERC20.sol";

contract oracle{
    uint public latestSpot;

    //lists all block heights at which spot is collected
    uint[] heights;
    //height => timestamp
    mapping(uint => uint) public timestamps;
    //timestamp => price
    mapping(uint => uint) public tsToSpot;


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
    }

    function set() public {
        (uint res0, uint res1, ) = IUniswapV2Pair(uniswapV2PairAddress).getReserves();
        latestSpot = token0Over1 ? inflator*res0/res1 : inflator*res1/res0;
        if (heights[heights.length-1] != block.number) heights.push(block.number);
        timestamps[block.number] = block.timestamp;
        tsToSpot[block.timestamp] = latestSpot;
        mostRecent = startHeight;
    }
    
    
    function tsToIndex(uint _time) public view returns (uint) {
        if (_time >= timestamps[heights[heights.length-1]]) return latestSpot;
        if (_time < timestamps[heights[0]] || heights.length < 3) return 0;
        if (tsToSpot[_time] != 0) return tsToSpot[_time];
        uint size = heights.length;
        uint step = size>>2;
        for (uint i = size>>1; ;){
            uint currentTs = timestamps[heights[i]];
            uint prevTs = i < 1 ? 0 : timestamps[heights[i-1]];
            uint nextTs = i+1 < heights.length ? timestamps[heights[i+1]]: timestamps[heights[heights.length-1]];
            /*
                p => prevTs
                c => currentTs
                n => nextTs
                Target => _time
                    On each iteration find where Target is in relation to others
                p, c, n, Target => increace i
                p, c, Target, n => c
                p, Target, c, n => p
                Target, p, c, n => decreace i
            */
            if (_time > nextTs)
                i = (i+step) < heights.length ? i+step : heights.length-1;                
            else if (_time > currentTs)
                return i;
            else if (_time > prevTs)
                return i-1;
            else
                i = i > step ? i-step : 0;
            step = (step>>1) > 0? step>>1: 1;
        }

    }

    function median3UpToIndex(uint _index) public view returns (uint) {
        require(_index > 1, "index must be 2 or greater");
        uint first = tsToSpot[timestamps[heights[_index-2]]];
        uint second = tsToSpot[timestamps[heights[_index-1]]];
        uint third = tsToSpot[timestamps[heights[_index]]];
        (first,second) = first > second ? (first, second) : (second,first);
        (second,third) = second > third ? (second, third) : (third,second);
        (first,second) = first > second ? (first, second) : (second,first);
        return second;
    }

    function height() public view returns(uint){
        return block.number;
    }

}