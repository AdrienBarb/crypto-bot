const inquirer = require("inquirer");
const ethers = require("ethers");
const { mnemonicToEntropy } = require("ethers/lib/utils");
require("dotenv").config();
const prompt = require("prompt-sync")({ sigint: true });

//ADRESSES
const addresses = {
  router: "0x10ed43c718714eb63d5aa57b78b54704e256024e",
  BNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  STABLE: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
  TOKEN_TO_SNIPE: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  PAIR: "0xa0feB3c81A36E885B6608DF7f0ff69dB97491b58",
  FACTORY: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
  WALLET_ADDRESS: process.env.WALLET_ADRESS,
};

//GAS
const gasPrice = ethers.utils.parseUnits("5", "gwei");
const gas = {
  gasPrice: gasPrice,
  gasLimit: 600000,
};

//ACCOUNT
const mnemonic = process.env.SEED_PHRASE;
const provider = new ethers.providers.WebSocketProvider(
  process.env.SERVER_NODE
);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const account = wallet.connect(provider);

//CONTRACTS
const routerContract = new ethers.Contract(
  addresses.router,
  [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns(uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  ],
  account
);

const factoryContract = new ethers.Contract(
  addresses.FACTORY,
  [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)",
  ],
  account
);

const getPair = async () => {
  try {
    const pair = await factoryContract.getPair(
      "0xe9e7cea3dedca5984780bafc599bd69add087d56",
      "0x3b76374Cc2DfE28Cc373DcA6d5024791B2586335"
    );
    console.log(pair);
  } catch (error) {
    console.log("ERRRORRRRRR");
  }
};

const getBalanceSellingOfToken = async (tokenContract) => {
  const ABI = [
    {
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      type: "function",
    },
  ];
  const newContract = new ethers.Contract(tokenContract, ABI, provider);
  const balance = await newContract.balanceOf(addresses.WALLET_ADDRESS);
  const balanceFormatted = ethers.utils.formatEther(balance);
  console.log(balanceFormatted);
  return balanceFormatted;
};

const sellToken = async () => {
  const sellingTokenContract = new ethers.Contract(
    addresses.TOKEN_TO_SNIPE,
    [
      "function approve(address spender, uint256 amount) external returns (bool)",
    ],
    account
  );

  const balanceOfTokenToSell = await getBalanceSellingOfToken(
    addresses.TOKEN_TO_SNIPE
  );

  console.log("Balance of token to sell ", balanceOfTokenToSell);

  const SELLTOKENAmountIn = ethers.utils.parseUnits(
    `${balanceOfTokenToSell}`,
    18
  );
  let amounts = await routerContract.getAmountsOut(SELLTOKENAmountIn, [
    addresses.TOKEN_TO_SNIPE,
    addresses.STABLE,
  ]);
  const BUYTOKENamountOutMin = amounts[1].sub(amounts[1].div(2));

  console.log(ethers.utils.formatEther(SELLTOKENAmountIn));
  console.log(ethers.utils.formatEther(BUYTOKENamountOutMin));

  const approveTx = await sellingTokenContract.approve(
    addresses.router,
    SELLTOKENAmountIn
  );
  await approveTx.wait();

  console.log(`Swapping tokens...`);
  const swapTx = await routerContract.swapExactTokensForTokens(
    SELLTOKENAmountIn,
    BUYTOKENamountOutMin,
    [addresses.TOKEN_TO_SNIPE, addresses.STABLE],
    addresses.WALLET_ADDRESS,
    Date.now() + 1000 * 60 * 10,
    { ...gas }
  );

  const receipt = await swapTx.wait();
  console.log(`Transaction hash: ${receipt.transactionHash}`);
};

inquirer
  .prompt([
    {
      type: "rawlist",
      name: "cryptoCommand",
      message: "What do you want?",
      choices: ["Sell token"],
    },
  ])
  .then((answers) => {
    console.info("Answer:", answers.cryptoCommand);
    switch (answers.cryptoCommand) {
      case "Sell token":
        sellToken();
        break;
      default:
        break;
    }
  });
