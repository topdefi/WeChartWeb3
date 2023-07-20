var EnumChainId = require('./chain.id');
var UtilsAddresses  =require('../utils/addresses');

const EnumMainTokens = {
    [EnumChainId.ARC]: {
        WARC: {
            address: UtilsAddresses.toCheckSum("0x9000688B5C45b9a37e89C33D9033C9073d1913f7"),
            decimals: 18
        },
        USDT: {
            address: UtilsAddresses.toCheckSum("0x9476e33eF6ecD588d29caf782d37620ccb2b9310"),
            decimals: 18
        }
    }
}

EnumMainTokens[EnumChainId.ARC].STABLE_COINS = [ "USDT" ].map( e => EnumMainTokens[EnumChainId.ARC][e].address );
EnumMainTokens[EnumChainId.ARC].MAIN = EnumMainTokens[EnumChainId.ARC]["WARC"];

// [0x10ED43C718714eb63d5aA57B78B54704E256024E, 0x10ED43C718714eb63d5aA57B78B54704E256024E,0x10ED43C718714eb63d5aA57B78B54704E256024E,0x10ED43C718714eb63d5aA57B78B54704E256024E,0x0000000000000000000000000000000000000000]
// [0xe9e7cea3dedca5984780bafc599bd69add087d56, 0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c, 0x55d398326f99059ff775485246999027b3197955, 0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d]
// 1000000000000000000
module.exports = EnumMainTokens;

// usdc -> usdt -> ice -> ftm 