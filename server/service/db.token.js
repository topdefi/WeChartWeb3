require('dotenv').config();
const EnumMainTokens = require('../../enum/mainTokens');
const UtilsAddresses = require('../../utils/addresses');
var TokenBasic = require('../models/token_basic');
var ServiceHistory = require('./db.history');
let TOKENS_PER_PAGE = 25;



async function findByContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: UtilsAddresses.toCheckSum(contract) }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos;
}
async function getSymbolFromContract( contract ){
    let tokenInfos = await TokenBasic.findOne({ contract: UtilsAddresses.toCheckSum(contract) }).select({ symbol: 1 }).lean().exec();
    if( !tokenInfos || tokenInfos.name == "$NULL" ) { return null }
    return tokenInfos.symbol;
}

async function findWithMostScoreAndNoFee( minimumPoints, returnRecordsAmount ){
    let bnb = await TokenBasic.findOne({ contract: EnumMainTokens[process.env.CHAIN_ID].MAIN.address }).lean().exec(); // sepcify bnb becouse it has no 'fee' object
    let queryRes = await TokenBasic.find({ score_points: { $gt: minimumPoints }, 'fees.buy': 0, 'fees.sell': 0 }).sort({ score_points: -1 }).limit(returnRecordsAmount).lean().exec();

    if( bnb ) queryRes.unshift(bnb); 
    
    return queryRes
}
async function findDecimals( tokens ){
    return await TokenBasic.find({ contract: { $in: tokens } }).select({ decimals: 1, contract: 1 }).lean().exec();
}

async function searchByUrlOrContract( urlOrContract ){
    let query = urlOrContract.trim().replace(/[^\w\s]/gi, '').split(" ").join("");
    let tokens = await TokenBasic.find({ 
        $or: [
            {name: { $regex: '.*' + query + '.*', $options: 'i' }}, 
            {contract: { $regex: '.*' + query + '.*', $options: 'i' }}
        ] 
    })
    .select({ name: 1, symbol: 1, contract: 1, pairs_count: 1 })
    .sort({ score_points: -1 })
    .limit(TOKENS_PER_PAGE)
    .exec();

    return tokens;
}

async function getPairs( contract ){
    let tokenPairs = await ServiceHistory.findPairs( contract );
    let pairs = {} // tokenAddress => { reserve: num, name: name }

    console.log( tokenPairs );

    for( let i in tokenPairs ){
        let pairInfos = tokenPairs[i];
        
        if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN.address ) pairs[pairInfos.pair] = {};
        else if( EnumMainTokens[pairInfos.chain].STABLE_COINS.includes( pairInfos.mainToken ) ) pairs[pairInfos.pair] = {};
        
        if( i == tokenPairs.length - 1 && !Object.keys(pairs).length ){}
        else if( !pairs[pairInfos.pair] ) continue;

        pairs[pairInfos.pair] = { 
            mainToken: pairInfos.mainToken, 
            mainReserveValue: pairInfos.mainReserveValue,
            router: pairInfos.router,
            chain: pairInfos.chain,
            value: pairInfos.value,
            mcap: pairInfos.mcap,
            variation: pairInfos.variation,
            tokens: {
                0: pairInfos.token0.symbol,
                1: pairInfos.token1.symbol
            }
        };

        if( pairInfos.mainToken == pairInfos.token0.contract ) pairs[pairInfos.pair].reserve = pairInfos.reserve0; 
        else pairs[pairInfos.pair].reserve = pairInfos.reserve1;
        
    }
    return pairs;
}
async function getPairsMultiple( contracts ){
    for( let i in contracts ){
        contracts[i] = UtilsAddresses.toCheckSum(contracts[i]);
    }

    let tokensPairs = await ServiceHistory.findPairsMultiple( contracts );
    if( !tokensPairs ) return {}
    
    let pairsRetrived = {} // tokenAddress: { pairAddress => { reserve: num, name: name } }
    for( let pairRetrived of tokensPairs ){
        if(!pairsRetrived[pairRetrived.dependantToken]) pairsRetrived[pairRetrived.dependantToken] = [];
        pairsRetrived[pairRetrived.dependantToken].push(pairRetrived);
    }
    let organizedPairs = {};
    for( let token in pairsRetrived ){
        let pairsToCheck = pairsRetrived[token];
        organizedPairs[token] = {};
        for( let i in pairsToCheck ){
            let pairInfos = pairsToCheck[i];
            
            if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN.address ) organizedPairs[token][pairInfos.pair] = {};
            else if( EnumMainTokens[pairInfos.chain].STABLE_COINS.includes( pairInfos.mainToken ) ) organizedPairs[token][pairInfos.pair] = {};
    
            if( i == pairsToCheck.length - 1 && !Object.keys(organizedPairs[token]).length ){}
            else if( !organizedPairs[token][pairInfos.pair] ) continue;
    
            organizedPairs[token][pairInfos.pair] = { 
                mainToken: pairInfos.mainToken, 
                mainReserveValue: pairInfos.mainReserveValue,
                name: pairInfos.token0.name, 
                router: pairInfos.router,
                chain: pairInfos.chain,
                value: pairInfos.value,
                mcap: pairInfos.mcap,
                variation: pairInfos.variation
            };
    
            if( pairInfos.mainToken == pairInfos.token0.contract ) organizedPairs[token][pairInfos.pair].reserve = pairInfos.reserve0; 
            else organizedPairs[token][pairInfos.pair].reserve = pairInfos.reserve1;
        }
    }
    
    return organizedPairs;
}

async function getSupplyMultiple( contracts ){
    for( let i in contracts ) contracts[i] = contracts[i];
    
    let retrivedSupplies = await findSupplyMultiple( contracts );
    let retrived = {};
    if(retrivedSupplies && retrivedSupplies.length ) {
        for( let info of retrivedSupplies ){
            retrived[ info.contract ] = info.total_supply;
        }
    }
    return retrived;
}

async function findSupplyMultiple( contracts ){
    let documents = await TokenBasic.find(
        { contract: { $in: contracts } }
    ).select({ contract: 1, total_supply: 1 }).lean().exec();
    if(!documents.length) return null;
    return documents;
}

async function getMainPair( contract ){

    let pairs = await getPairs( contract ) // tokenAddress => pair informations
    let token = await TokenBasic.findOne({contract : contract}).select({total_supply: 1}).lean().exec();
    let totalSupply = token ? token.total_supply : 0;
   
    let mainPair = null; // each token probably has a pair with bnb or main stable coins, and we prefer that ones
    let mainPairVal = 0;
    let pairInfos = {};

    for( let pair in pairs ){
        let pairDetails = pairs[pair];
        
        if( pairDetails.mainToken === EnumMainTokens[pairDetails.chain].MAIN.address ) {
            if( pairDetails.mainReserveValue > mainPairVal ){
                mainPair = pair;
                mainPairVal = pairDetails.mainReserveValue;
                pairInfos = pairDetails;
            }
        }
        else if( EnumMainTokens[pairDetails.chain].STABLE_COINS.includes( pairDetails.mainToken ) ) {
            if( pairDetails.mainReserveValue > mainPairVal ) {
                mainPair = pair;
                mainPairVal = pairDetails.mainReserveValue;
                pairInfos = pairDetails;
            }
        }
    }

    if( !mainPair ) {
        mainPair = Object.keys( pairs )[0];
        let pairDetails = pairs[mainPair];


        if( !pairDetails )  {
            return {
                mainPair: null,
                mainPairVal: 0,
                pairInfos: {},
                totalSupply: totalSupply
            }
        }

        mainPairVal = pairDetails.mainReserveValue;
        return {
            mainPair: mainPair,
            mainPairVal: mainPairVal,
            pairInfos: pairDetails,
            totalSupply: totalSupply
        }
    } else {
        return {
            mainPair: mainPair,
            mainPairVal: mainPairVal,
            pairInfos: pairInfos,
            totalSupply: totalSupply
        };
    } ; // if no mainPair was found, return the first pair inside the object
    
}
async function getMainPairMultiple( contracts ){

    for( let i in contracts ){
        contracts[i] = UtilsAddresses.toCheckSum(contracts[i]);
    }

    let tokensPairs = await getPairsMultiple( contracts ) // tokenAddress => { pair address: pair informations }
    let tokensSupplies = await getSupplyMultiple( contracts )

    

    let mainPairs = {};
    for( let token in tokensPairs ){
        let pairs = tokensPairs[token];
        mainPairs[token] = { mainPair: null, mainPairVal: 0, pairInfos: {}, totalSupply: tokensSupplies[token] }

        for( let pair in pairs ){

            
            
            let pairInfos = pairs[pair];


            if( pairInfos.mainToken === EnumMainTokens[pairInfos.chain].MAIN.address ) {
              
                if( pairInfos.mainReserveValue >  mainPairs[token].mainPairVal ){
                   
                    mainPairs[token].mainPair = pair;
                    mainPairs[token].mainPairVal = pairInfos.mainReserveValue;
                    mainPairs[token].pairInfos = pairInfos;
                }
            }
            else if( EnumMainTokens[pairInfos.chain].STABLE_COINS.includes( pairInfos.mainToken ) ) {
               
                if( pairInfos.mainReserveValue >  mainPairs[token].mainPairVal ) {
                    
                    mainPairs[token].mainPair = pair;
                    mainPairs[token].mainPairVal = pairInfos.mainReserveValue;
                    mainPairs[token].pairInfos = pairInfos;
                }
            }
        }
        if( !mainPairs[token] ) {  // if no mainPair was found, return the first pair inside the token pairs
            
            mainPairs[token].mainPair = Object.keys( pairs )[0];
        }
    }
    return mainPairs;
}
module.exports = {
    findByContract,
    getSymbolFromContract,
    getMainPair,
    getMainPairMultiple,
    getPairs,
    searchByUrlOrContract,
    findWithMostScoreAndNoFee,
    findDecimals
}