const UtilsAddresses = require("../utils/addresses");
const EnumChainId = require("./chain.id");

const EnumContracts = {
    [EnumChainId.ARC]: {
        MAIN_ROUTER: UtilsAddresses.toCheckSum("0x052967739A95D258c44Cf9a79F3135c1291d9fe5"), // ArchieSwap
        MAIN_FACTORY: UtilsAddresses.toCheckSum("0x265beF08d618051A923502C106aE9002159d9bdF") // ArchieSwap
    }
};

module.exports = EnumContracts