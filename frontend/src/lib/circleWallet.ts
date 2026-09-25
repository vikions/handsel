import { createPublicClient, parseGwei, type Address, type Chain, type Hex } from "viem";

export type CircleWalletMode = "login" | "register";
type Listener = (...args: unknown[]) => void;
type Request = { method: string; params?: unknown };
const rememberedAddressKey = (network: "mainnet" | "testnet") => `handsel.circle-wallet.${network}.address`;

export function createCirclePasskeyProvider(options: {
  chain: Chain;
  network: "mainnet" | "testnet";
  clientKey: string;
  clientUrl: string;
}) {
  let mode: CircleWalletMode = "login";
  let session: Awaited<ReturnType<typeof createSession>> | undefined;
  const storageKey = rememberedAddressKey(options.network);
  let rememberedAddress = loadRememberedAddress(storageKey);
  const listeners = new Map<string, Set<Listener>>();

  const provider = {
    setMode(nextMode: CircleWalletMode) {
      mode = nextMode;
    },
    async disconnect() {
      session = undefined;
      rememberedAddress = undefined;
      window.localStorage.removeItem(storageKey);
      emit("accountsChanged", []);
      emit("disconnect", { code: 4900, message: "Circle wallet disconnected." });
    },
    async request({ method, params }: Request): Promise<unknown> {
      const requestParams = Array.isArray(params) ? params : [];
      if (method === "eth_chainId") return `0x${options.chain.id.toString(16)}`;
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_accounts") return session ? [session.address] : rememberedAddress ? [rememberedAddress] : [];
      if (method === "eth_requestAccounts") {
        const active = await ensureSession();
        return [active.address];
      }

      const active = await ensureSession();
      if (method === "personal_sign") {
        const [message, requestedAddress] = requestParams as [Hex, Address];
        assertAccount(requestedAddress, active.address);
        return active.account.signMessage({ message: { raw: message } });
      }
      if (method === "eth_signTypedData_v4") {
        const [requestedAddress, typedData] = requestParams as [Address, string];
        assertAccount(requestedAddress, active.address);
        return active.account.signTypedData(JSON.parse(typedData));
      }
      if (method === "eth_sendTransaction") {
        const [transaction] = requestParams as [{ from?: Address; to?: Address; data?: Hex; value?: Hex }];
        if (!transaction.to) throw new Error("Circle wallet transaction is missing a destination.");
        if (transaction.from) assertAccount(transaction.from, active.address);
        const accountCode = await active.publicClient.getCode({ address: active.address });
        const isDeployed = Boolean(accountCode && accountCode !== "0x");
        const estimatedFees = await active.publicClient.estimateFeesPerGas({ type: "eip1559" });
        const minimumPriorityFee = options.network === "testnet"
          ? parseGwei("1.2")
          : estimatedFees.maxPriorityFeePerGas;
        const maxPriorityFeePerGas = maxBigInt(
          estimatedFees.maxPriorityFeePerGas,
          minimumPriorityFee,
        );
        const adjustedMaxFee =
          estimatedFees.maxFeePerGas +
          (maxPriorityFeePerGas - estimatedFees.maxPriorityFeePerGas);
        const maxFeePerGas = maxBigInt((adjustedMaxFee * 120n) / 100n, maxPriorityFeePerGas);
        const userOpHash = await active.bundlerClient.sendUserOperation({
          account: active.account,
          calls: [
            {
              to: transaction.to,
              data: transaction.data || "0x",
              value: transaction.value ? BigInt(transaction.value) : 0n,
            },
          ],
          // The first sponsored operation deploys the smart account at nonce zero.
          paymaster: true,
          ...(isDeployed ? {} : { nonce: 0n }),
          // Testnet currently needs a floor; mainnet uses the live bundler estimate.
          maxFeePerGas,
          maxPriorityFeePerGas,
        });
        try {
          const operationReceipt = await active.bundlerClient.waitForUserOperationReceipt({
            hash: userOpHash,
            timeout: 90_000,
          });
          if (!operationReceipt.success) {
            throw new Error(`Circle UserOperation ${userOpHash} reverted onchain. Check Circle Console before retrying.`);
          }
          return operationReceipt.receipt.transactionHash;
        } catch (error) {
          if (error instanceof Error && error.name.includes("Timeout")) {
            throw new Error(
              `Circle accepted UserOperation ${userOpHash}, but it was not included on Arc within 90 seconds. Check its status in Circle Console before retrying.`,
            );
          }
          throw error;
        }
      }

      return active.publicClient.request({ method, params: requestParams } as never);
    },
    on(event: string, listener: Listener) {
      const eventListeners = listeners.get(event) || new Set<Listener>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return provider;
    },
    removeListener(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener);
      return provider;
    },
  };

  async function ensureSession() {
    if (session) return session;
    if (!options.clientKey || !options.clientUrl) {
      throw new Error("Circle passkey wallet is not configured for this domain.");
    }
    session = await createSession(options, mode);
    rememberedAddress = session.address;
    window.localStorage.setItem(storageKey, session.address);
    emit("connect", { chainId: `0x${options.chain.id.toString(16)}` });
    emit("accountsChanged", [session.address]);
    return session;
  }

  function emit(event: string, ...args: unknown[]) {
    listeners.get(event)?.forEach((listener) => listener(...args));
  }

  return provider;
}

async function createSession(
  options: { chain: Chain; network: "mainnet" | "testnet"; clientKey: string; clientUrl: string },
  mode: CircleWalletMode,
) {
  const [circle, accountAbstraction] = await Promise.all([
    import("@circle-fin/modular-wallets-core"),
    import("viem/account-abstraction"),
  ]);
  const {
    WebAuthnMode,
    toCircleSmartAccount,
    toModularTransport,
    toPasskeyTransport,
    toWebAuthnCredential,
  } = circle;
  const { createBundlerClient, toWebAuthnAccount } = accountAbstraction;
  const passkeyTransport = toPasskeyTransport(options.clientUrl, options.clientKey);
  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: mode === "register" ? WebAuthnMode.Register : WebAuthnMode.Login,
    username: mode === "register" ? "Handsel" : undefined,
  });
  const networkPath = options.network === "mainnet" ? "arc" : "arcTestnet";
  const modularTransport = toModularTransport(`${options.clientUrl}/${networkPath}`, options.clientKey);
  const publicClient = createPublicClient({ chain: options.chain, transport: modularTransport });
  const account = await toCircleSmartAccount({
    client: publicClient,
    owner: toWebAuthnAccount({ credential }),
  });
  const bundlerClient = createBundlerClient({ account, chain: options.chain, transport: modularTransport });

  return { account, address: account.address, bundlerClient, publicClient };
}

function loadRememberedAddress(storageKey: string): Address | undefined {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as Address) : undefined;
  } catch {
    return undefined;
  }
}

function maxBigInt(left: bigint, right: bigint) {
  return left > right ? left : right;
}

function assertAccount(requested: Address, actual: Address) {
  if (requested.toLowerCase() !== actual.toLowerCase()) throw new Error("Circle wallet account mismatch.");
}
