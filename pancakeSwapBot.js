const inquirer = require('inquirer')
const ethers = require('ethers')
const { mnemonicToEntropy } = require('ethers/lib/utils')
require('dotenv').config()
const prompt = require('prompt-sync')({ sigint: true })

//ADRESSES
const addresses = {
  router: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
  BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  STABLE: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  TOKEN_TO_SNIPE: '0xdb42ff764E0B1e1D63F10135FB0Cf1F848d428DE',
  PAIR: '0xa0feB3c81A36E885B6608DF7f0ff69dB97491b58',
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
const pairContract = new ethers.Contract(
  addresses.PAIR,
  [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
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

const getPair = async () => {
  try {
    const pair = await factoryContract.getPair(
      '0xe9e7cea3dedca5984780bafc599bd69add087d56',
      '0x3b76374Cc2DfE28Cc373DcA6d5024791B2586335'
    )
    console.log(pair)
  } catch (error) {
    console.log('ERRRORRRRRR')
  }
}

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
  const balance = await provider.getBalance(process.env.WALLET_ADRESS)
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

const buyToken = async () => {
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

        const sellingTokenContract = new ethers.Contract(
          addresses.STABLE,
          [
            'function approve(address spender, uint256 amount) external returns (bool)',
          ],
          account
        )

        const balanceOfTokenToSell = await getBalanceSellingOfToken(
          addresses.STABLE
        )

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

        console.log(`Swapping tokens for tokens...`)
        const receipt = await swapTx.wait()
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
  const BUYTOKENamountOutMin = amounts[1].sub(amounts[1].div(2))

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

const automaticBuyAndSell = async () => {
  const amountOfBNB = '0.001'
  const tokenToSnipe = prompt('Token adress to snipe: ')
  console.log('Swap token: ', tokenToSnipe)

  const tx = await routerContract.swapExactETHForTokens(
    0,
    [addresses.BNB, tokenToSnipe],
    addresses.WALLET_ADDRESS,
    Math.floor(Date.now() / 1000) + 60 * 10,
    {
      ...gas,
      value: ethers.utils.parseUnits(amountOfBNB, 18),
    }
  )

  console.log(`Swapping BNB for tokens...`)
  const receipt = await tx.wait()
  console.log(`Transaction hash: ${receipt.transactionHash}`)

  const sellToken = async () => {
    const sellingTokenContract = new ethers.Contract(
      tokenToSnipe,
      [
        'function approve(address spender, uint256 amount) external returns (bool)',
      ],
      account
    )

    const balanceOfTokenToSell = await getBalanceSellingOfToken(tokenToSnipe)

    console.log('Balance of token to sell ', balanceOfTokenToSell)

    const SELLTOKENAmountIn = ethers.utils.parseUnits(
      `${balanceOfTokenToSell}`,
      18
    )
    let amounts = await routerContract.getAmountsOut(SELLTOKENAmountIn, [
      tokenToSnipe,
      addresses.BNB,
    ])
    const BUYTOKENamountOutMin = amounts[1].sub(amounts[1].div(10))

    console.log(
      'Amount of buying token: ',
      ethers.utils.formatEther(SELLTOKENAmountIn)
    )
    console.log(
      'Amount min of selling token: ',
      ethers.utils.formatEther(BUYTOKENamountOutMin)
    )

    const amountOfBuyingToken = parseFloat(amountOfBNB)
    const amountOutOfToken = parseFloat(ethers.utils.formatEther(amounts[1]))
    console.log('Diff token :', amountOutOfToken, amountOfBuyingToken)
    if (amountOutOfToken > 1.2 * amountOfBuyingToken) {
      console.log('Je vends x2 :', 1.2 * amountOfBuyingToken)
      const approveTx = await sellingTokenContract.approve(
        addresses.router,
        SELLTOKENAmountIn
      )
      await approveTx.wait()

      console.log(`Swapping tokens...`)
      const swapTx = await routerContract.swapExactTokensForTokens(
        SELLTOKENAmountIn,
        BUYTOKENamountOutMin,
        [tokenToSnipe, addresses.BNB],
        addresses.WALLET_ADDRESS,
        Date.now() + 1000 * 60 * 10,
        { ...gas }
      )

      const receipt = await swapTx.wait()
      console.log(`Transaction hash: ${receipt.transactionHash}`)

      clearInterval(timer)
    } else if (amountOutOfToken < 0.2 * amountOfBuyingToken) {
      console.log('Je vends /2 :')

      // const approveTx = await sellingTokenContract.approve(
      //   addresses.router,
      //   SELLTOKENAmountIn
      // )
      // await approveTx.wait()
      // console.log(`Swapping tokens...`)
      // const swapTx = await routerContract.swapExactTokensForTokens(
      //   SELLTOKENAmountIn,
      //   BUYTOKENamountOutMin,
      //   [tokenToSnipe, addresses.BNB],
      //   addresses.WALLET_ADDRESS,
      //   Date.now() + 1000 * 60 * 10,
      //   { ...gas }
      // )
      // const receipt = await swapTx.wait()
      // console.log(`Transaction hash: ${receipt.transactionHash}`)
      // clearInterval(timer)
    }
  }

  const timer = setInterval(sellToken, 5000)
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
        'Automatic Buy',
        'Buy token with BNB',
        'Buy token',
        'Sell token',
        'Get pair',
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
      case 'Automatic Buy':
        automaticBuyAndSell()
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
      case 'Get pair':
        getPair()
        break
      default:
        break
    }
  })
