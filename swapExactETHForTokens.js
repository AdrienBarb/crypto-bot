const inquirer = require('inquirer')
const ethers = require('ethers')
require('dotenv').config()
const prompt = require('prompt-sync')({ sigint: true })

//ADRESSES
const addresses = {
  router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
  BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  TOKEN_TO_SNIPE: '0x35074F53FfF5a992d195DaFCFe4e11349e8016Dc',
  FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  WALLET_ADDRESS: process.env.WALLET_ADRESS,
}

//GAS
const gasPrice = ethers.utils.parseUnits('5', 'gwei')
const gas = {
  gasPrice: gasPrice,
  gasLimit: 600000,
}

//ACCOUNT
const mnemonic = process.env.SEED_PHRASE
const provider = new ethers.providers.WebSocketProvider(process.env.SERVER_NODE)
const wallet = ethers.Wallet.fromMnemonic(mnemonic)
const account = wallet.connect(provider)

//CONTRACTS
const routerContract = new ethers.Contract(
  addresses.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns(uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  ],
  account
)

const factoryContract = new ethers.Contract(
  addresses.FACTORY,
  [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  ],
  account
)

const getBalanceOfBNB = async () => {
  const balance = await provider.getBalance(process.env.WALLET_ADRESS)
  const balanceFormatted = ethers.utils.formatEther(balance)
  console.log(balanceFormatted)
}

const buyTokenWithBNB = async () => {
  const automaticBuy = async () => {
    try {
      const pair = await factoryContract.getPair(
        addresses.TOKEN_TO_SNIPE,
        addresses.BNB
      )

      if (pair !== '0x0000000000000000000000000000000000000000') {
        console.log('Pair found ', pair)
        clearInterval(timer)
        console.log('Clearing interval')
        const tx = await routerContract.swapExactETHForTokens(
          0,
          [addresses.BNB, addresses.TOKEN_TO_SNIPE],
          addresses.WALLET_ADDRESS,
          Math.floor(Date.now() / 1000) + 60 * 10,
          {
            ...gas,
            value: ethers.utils.parseUnits('0.001', 18),
          }
        )

        console.log(`Swapping BNB for tokens...`)
        const receipt = await tx.wait()
        console.log(`Transaction hash: ${receipt.transactionHash}`)
      } else {
        console.log('Pair not found')
      }
    } catch (error) {
      console.log('There is an error ', error)
    }
  }

  const timer = setInterval(automaticBuy, 5000)
}

inquirer
  .prompt([
    {
      type: 'rawlist',
      name: 'cryptoCommand',
      message: 'What do you want?',
      choices: ['Get balance of BNB', 'Buy token with BNB'],
    },
  ])
  .then((answers) => {
    console.info('Answer:', answers.cryptoCommand)
    switch (answers.cryptoCommand) {
      case 'Get balance of BNB':
        getBalanceOfBNB()
        break
      case 'Buy token with BNB':
        buyTokenWithBNB()
        break
      default:
        break
    }
  })
