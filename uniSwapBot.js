const inquirer = require('inquirer')
const ethers = require('ethers')

//ADRESSES
const addresses = {
  router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  STABLE: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
  TOKEN_TO_SNIPE: '0x25382Fb31e4b22E0EA09cB0761863dF5AD97ed72',
  PAIR: '0x48725D18096822B6522afC9Dd6136D8b9DB4636B',
  WALLET_ADDRESS: '0x037eEd581e2e634D8472176D22c58C77F4D1cda2',
}

//GAS
const gasPrice = ethers.utils.parseUnits('40', 'gwei')
const gas = {
  gasPrice: gasPrice,
  gasLimit: 200000,
}

//ACCOUNT
const mnemonic =
  'bike oven gather narrow stone tissue cable forget drastic evolve fancy asset'
const provider = new ethers.providers.WebSocketProvider(
  'wss://speedy-nodes-nyc.moralis.io/bc8cfa0017163ce51d7052a6/eth/mainnet/ws'
)
const wallet = ethers.Wallet.fromMnemonic(mnemonic)
const account = wallet.connect(provider)

//CONTRACTS
const routerContract = new ethers.Contract(
  addresses.router,
  [
    'function getAmountsOut(uint amountIn, address[] memory path) public view returns(uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  ],
  account
)
const pairContract = new ethers.Contract(
  addresses.PAIR,
  [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
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

const getBalanceOfBNB = async () => {
  const balance = await provider.getBalance(
    '0x037eEd581e2e634D8472176D22c58C77F4D1cda2'
  )
  const balanceFormatted = ethers.utils.formatEther(balance)
  console.log(balanceFormatted)
}

const getReserve = async () => {
  const pairData = await pairContract.getReserves()
  const leftPair = ethers.utils.formatUnits(pairData[0], 18)
  const rightPair = ethers.utils.formatUnits(pairData[1], 18)

  const conversion = parseInt(rightPair) / parseInt(leftPair)

  console.log(`
  Token Price:
  ~~~~~~~~~~~~~~~~~~~~~~~
  Price: ${conversion}
  ~~~~~~~~~~~~~~~~~~~~~~~
  `)
}

const buyTokenWithBNB = async () => {
  let success = true

  try {
    const tx = await routerContract.swapExactETHForTokens(
      0,
      [addresses.BNB, addresses.TOKEN_TO_SNIPE],
      addresses.WALLET_ADDRESS,
      Math.floor(Date.now() / 1000) + 60 * 10,
      {
        ...gas,
        value: ethers.utils.parseUnits('0.005', 18),
      }
    )

    console.log(`Swapping BNB for tokens...`)
    const receipt = await tx.wait()
    console.log(`Transaction hash: ${receipt.transactionHash}`)
    success = false
  } catch (error) {
    console.log('ERROR ', error)
  }
}

const buyToken = async () => {
  const sellingTokenContract = new ethers.Contract(
    addresses.STABLE,
    [
      'function approve(address spender, uint256 amount) external returns (bool)',
    ],
    account
  )

  const balanceOfTokenToSell = await getBalanceSellingOfToken(addresses.STABLE)

  console.log('Balance of token to sell ', balanceOfTokenToSell)

  const SELLTOKENAmountIn = ethers.utils.parseUnits(
    `${balanceOfTokenToSell}`,
    18
  )
  let amounts = await routerContract.getAmountsOut(SELLTOKENAmountIn, [
    addresses.STABLE,
    addresses.TOKEN_TO_SNIPE,
  ])
  const BUYTOKENamountOutMin = amounts[1].sub(amounts[1].div(10))

  console.log(ethers.utils.formatEther(SELLTOKENAmountIn))
  console.log(ethers.utils.formatEther(BUYTOKENamountOutMin))

  const approveTx = await sellingTokenContract.approve(
    addresses.router,
    SELLTOKENAmountIn
  )
  await approveTx.wait()

  console.log(`Swapping tokens...`)
  const swapTx = await routerContract.swapExactTokensForTokens(
    SELLTOKENAmountIn,
    BUYTOKENamountOutMin,
    [addresses.STABLE, addresses.TOKEN_TO_SNIPE],
    addresses.WALLET_ADDRESS,
    Date.now() + 1000 * 60 * 10,
    { ...gas }
  )

  const receipt = await swapTx.wait()
  console.log(`Transaction hash: ${receipt.transactionHash}`)
}

const sellToken = async () => {
  const sellingTokenContract = new ethers.Contract(
    addresses.TOKEN_TO_SNIPE,
    [
      'function approve(address spender, uint256 amount) external returns (bool)',
    ],
    account
  )

  const balanceOfTokenToSell = await getBalanceSellingOfToken(
    addresses.TOKEN_TO_SNIPE
  )

  console.log('Balance of token to sell ', balanceOfTokenToSell)

  const SELLTOKENAmountIn = ethers.utils.parseUnits(
    `${balanceOfTokenToSell}`,
    18
  )
  let amounts = await routerContract.getAmountsOut(SELLTOKENAmountIn, [
    addresses.TOKEN_TO_SNIPE,
    addresses.STABLE,
  ])
  const BUYTOKENamountOutMin = amounts[1].sub(amounts[1].div(10))

  console.log(ethers.utils.formatEther(SELLTOKENAmountIn))
  console.log(ethers.utils.formatEther(BUYTOKENamountOutMin))

  const approveTx = await sellingTokenContract.approve(
    addresses.router,
    SELLTOKENAmountIn
  )
  await approveTx.wait()

  console.log(`Swapping tokens...`)
  const swapTx = await routerContract.swapExactTokensForTokens(
    SELLTOKENAmountIn,
    BUYTOKENamountOutMin,
    [addresses.TOKEN_TO_SNIPE, addresses.STABLE],
    addresses.WALLET_ADDRESS,
    Date.now() + 1000 * 60 * 10,
    { ...gas }
  )

  const receipt = await swapTx.wait()
  console.log(`Transaction hash: ${receipt.transactionHash}`)
}

inquirer
  .prompt([
    {
      type: 'rawlist',
      name: 'cryptoCommand',
      message: 'What do you want?',
      choices: [
        'Get balance of BNB',
        'Get balance of STABLE',
        'Get reserve',
        'Buy token with BNB',
        'Buy token',
        'Sell token',
      ],
    },
  ])
  .then((answers) => {
    console.info('Answer:', answers.cryptoCommand)
    switch (answers.cryptoCommand) {
      case 'Get balance of BNB':
        getBalanceOfBNB()
        break
      case 'Get balance of STABLE':
        getBalanceSellingOfToken(addresses.STABLE)
        break
      case 'Get reserve':
        getReserve()
        break
      case 'Buy token with BNB':
        buyTokenWithBNB()
        break
      case 'Buy token':
        buyToken()
        break
      case 'Sell token':
        sellToken()
        break
      default:
        break
    }
  })
