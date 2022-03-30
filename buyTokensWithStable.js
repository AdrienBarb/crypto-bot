const inquirer = require('inquirer')
const ethers = require('ethers')
require('dotenv').config()
const prompt = require('prompt-sync')({ sigint: true })

//ADRESSES
const addresses = {
  router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
  STABLE: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
  TOKEN_TO_SNIPE: '0x3Ca994D9f723736381d44388bC8dD1e7eE8C1653',
  PAIR: '0xa0feB3c81A36E885B6608DF7f0ff69dB97491b58',
  FACTORY: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  WALLET_ADDRESS: process.env.WALLET_ADRESS,
}

//GAS
const gasPrice = ethers.utils.parseUnits('5', 'gwei')
const gas = {
  gasPrice: gasPrice,
  gasLimit: 400000,
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

const getBalanceSellingOfToken = async (tokenContract) => {
  const ABI = [
    {
      constant: true,
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      type: 'function',
    },
  ]
  const newContract = new ethers.Contract(tokenContract, ABI, provider)
  const balance = await newContract.balanceOf(addresses.WALLET_ADDRESS)
  const balanceFormatted = ethers.utils.formatEther(balance)
  console.log(balanceFormatted)
  return balanceFormatted
}

const buyToken = async () => {
  let shouldRetryTransaction = true
  let counter = 0
  let transactionErrorLimit = 5
  let transactionErrorCounter = 0
  const sellingTokenContract = new ethers.Contract(
    addresses.STABLE,
    [
      'function approve(address spender, uint256 amount) external returns (bool)',
    ],
    account
  )
  const SELLTOKENAmountIn = ethers.utils.parseUnits(`0.1`, 18)
  const approveTx = await sellingTokenContract.approve(
    addresses.router,
    SELLTOKENAmountIn
  )
  await approveTx.wait()

  const automaticBuy = async () => {
    try {
      const pair = await factoryContract.getPair(
        addresses.TOKEN_TO_SNIPE,
        addresses.STABLE
      )

      if (pair !== '0x0000000000000000000000000000000000000000') {
        console.log('Pair found ', pair)

        clearInterval(timer)
        console.log('Clearing interval')

        console.log(`Swapping tokens...`)
        const swapTx = await routerContract.swapExactTokensForTokens(
          SELLTOKENAmountIn,
          0,
          [addresses.STABLE, addresses.TOKEN_TO_SNIPE],
          addresses.WALLET_ADDRESS,
          Date.now() + 1000 * 60 * 10,
          { ...gas }
        )

        console.log(`Mining transaction...`)
        while (shouldRetryTransaction) {
          try {
            const receipt = await swapTx.wait()
            console.log(`Transaction hash: ${receipt.transactionHash}`)
            shouldRetryTransaction = false
          } catch (error) {
            transactionErrorCounter += 1
            console.log('Error while mining ', error)
            if (transactionErrorCounter >= transactionErrorLimit) {
              shouldRetryTransaction = false
            }
          }
        }
      } else {
        console.log('Pair not found')
      }
    } catch (error) {
      console.log('There is an error ', error)
    }
    counter += 1
    console.log('Counter ', counter)
  }

  const timer = setInterval(automaticBuy, 1000)
}

inquirer
  .prompt([
    {
      type: 'rawlist',
      name: 'cryptoCommand',
      message: 'What do you want?',
      choices: ['Buy token'],
    },
  ])
  .then((answers) => {
    console.info('Answer:', answers.cryptoCommand)
    switch (answers.cryptoCommand) {
      case 'Buy token':
        buyToken()
        break

      default:
        break
    }
  })
