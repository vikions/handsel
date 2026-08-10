import { createPublicClient, type Address, type Chain, type Hex } from "viem";

export type CircleWalletMode = "login" | "register";
type Listener = (...args: unknown[]) => void;
type Request = { method: string; params?: unknown };

export function createCirclePasskeyProvider(options: {
  chain: Chain;
  clientKey: string;
  clientUrl: string;
}) {
  let mode: CircleWalletMode = "login";
  let session: Awaited<ReturnType<typeof createSession>> | undefined;
  const listeners = new Map<string, Set<Listener>>();

  const provider = {
    setMode(nextMode: CircleWalletMode) {
      mode = nextMode;
    },
    async disconnect() {
      session = undefined;
      emit("accountsChanged", []);
      emit("disconnect", { code: 4900, message: "Circle wallet disconnected." });
    },
    async request({ method, params }: Request): Promise<unknown> {
      const requestParams = Array.isArray(params) ? params : [];
      if (method === "eth_chainId") return `0x${options.chain.id.toString(16)}`;
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "eth_accounts") return session ? [session.address] : [];
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
        const [transaction] = requestParams as [{ to?: Address; data?: Hex; value?: Hex }];
        if (!transaction.to) throw new Error("Circle wallet transaction is missing a destination.");
        const accountCode = await active.publicClient.getCode({ address: active.address });
        const userOpHash = await active.bundlerClient.sendUserOperation({
          account: active.account,
          calls: [
            {
              to: transaction.to,
              data: transaction.data || "0x",
              value: transaction.value ? BigInt(transaction.value) : 0n,
            },
          ],
          paymaster: true,
          // Circle MSCAs deploy lazily and require nonce zero for their first user operation.
          ...(accountCode && accountCode !== "0x" ? {} : { nonce: 0n }),
        });
        const { receipt } = await active.bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
        return receipt.transactionHash;
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
  options: { chain: Chain; clientKey: string; clientUrl: string },
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
  const modularTransport = toModularTransport(`${options.clientUrl}/arcTestnet`, options.clientKey);
  const publicClient = createPublicClient({ chain: options.chain, transport: modularTransport });
  const account = await toCircleSmartAccount({
    client: publicClient,
    owner: toWebAuthnAccount({ credential }),
  });
  const bundlerClient = createBundlerClient({ account, chain: options.chain, transport: modularTransport });

  return { account, address: account.address, bundlerClient, publicClient };
}

function assertAccount(requested: Address, actual: Address) {
  if (requested.toLowerCase() !== actual.toLowerCase()) throw new Error("Circle wallet account mismatch.");
}
