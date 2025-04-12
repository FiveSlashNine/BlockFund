# BlockFund

A full-stack decentralized crowdfunding platform built with **React** and **Solidity**. This platform allows entrepreneurs to launch fundraising campaigns, while users can contribute funds and receive refunds if goals aren't met. A contract owner has admin privileges to manage campaigns and platform integrity.

## 🚀 Features

### 🧑‍💼 Entrepreneurs

- Create crowdfunding campaigns with a funding goal and deadline.
- Mark campaigns as **completed** once the goal is reached.
- Cancel campaigns if needed (before completion or expiration).

### 🙋‍♂️ Contributors

- Fund active campaigns using ETH.
- Request a **refund** if a campaign is canceled or fails to reach its goal.

### 👑 Contract Owner

- Ban/unban entrepreneurs (prevent campaign creation).
- Cancel any campaign on the platform.
- Transfer ownership of the contract.
- Permanently delete (self-destruct) the contract.

### ✨ Special Address

- Can do anything that the owner can

## 📦 Installation

### 1. Clone the repository

```bash
git clone https://github.com/FiveSlashNine/BlockFund.git
cd BlockFund
```

### 2. Change the special address in Crowdfunding.sol

```bash
Open the Crowdfunding.sol file.
Go to line 93.
Change the wallet address with your own.
```

### 3. Deploy the Crowdfunding.sol contract on the eth blockchain

### 4. Set the contract address

```bash
cd BlockFund/src
Open the crowdfungind.js file.
Go to line 3.
Change the address with the one from your contract.
```

### 5. Install the dependencies for the frontend

```bash
cd BlockFund
npm install
```

## Site Preview

![preview](./preview.png)
