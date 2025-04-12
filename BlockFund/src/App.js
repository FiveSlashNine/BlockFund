import React, { Component } from "react";
import "bootstrap/dist/css/bootstrap.css";
import web3 from "./web3";
import crowdfunding from "./crowdfunding";

class App extends Component {
  state = {
    owner: "",
    balance: "",
    liveCampaigns: [],
    fulfilledCampaigns: [],
    canceledCampaigns: [],
    isBanned: "",
    collectedFees: "",
    currentAccount: "",
    campaignFee: "",
    campaignTitle: "",
    campaignCost: "",
    campaignPledges: "",
    campaignNotValid: "",
    banEntrepreneurAddress: "",
    newOnwerAddress: "",
    hasFundsToWithdraw: "",
    terminated: "",
    specialWallet: "",
  };

  retrieveCampaigns = async () => {
    const campaigns = await crowdfunding.methods.getAllCampaigns().call({
      from: this.state.currentAccount,
    });

    const canceledCampaigns = [],
      liveCampaigns = [],
      fulfilledCampaigns = [];

    campaigns.forEach((campaign) => {
      if (campaign.canceled) {
        canceledCampaigns.push(campaign);
      } else if (campaign.fulfilled) {
        fulfilledCampaigns.push(campaign);
      } else {
        liveCampaigns.push(campaign);
      }
      this.setState({
        liveCampaigns,
        canceledCampaigns,
        fulfilledCampaigns,
      });
    });
  };

  async componentDidMount() {
    try {
      const owner = await crowdfunding.methods.owner().call();
      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );
      const collectedFees = web3.utils.fromWei(
        await crowdfunding.methods.totalPlatformFees().call(),
        "ether"
      );
      const campaignFee = await crowdfunding.methods.campaignFee().call();

      const terminated = await crowdfunding.methods.terminated().call();

      const specialWallet = web3.utils.toChecksumAddress(
        await crowdfunding.methods.specialWallet().call()
      );

      this.setState({
        owner,
        balance,
        specialWallet,
        collectedFees,
        campaignFee,
        terminated,
      });
      try {
        const currentAccount = web3.utils.toChecksumAddress(
          (await window.ethereum.request({ method: "eth_requestAccounts" }))[0]
        );

        const isBanned = await crowdfunding.methods
          .bannedEntrepreneurs(currentAccount)
          .call();

        const hasFundsToWithdraw = await crowdfunding.methods
          .isRefundAvailable()
          .call({
            from: currentAccount,
          });

        this.setState(
          { currentAccount, isBanned, hasFundsToWithdraw },
          async () => {
            await this.retrieveCampaigns();
          }
        );
      } catch (error) {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
    }
    if (!this.eventListenersSet) {
      this.setupEventListeners();
      this.eventListenersSet = true;
    }
  }

  setupEventListeners() {
    window.ethereum.on("accountsChanged", async (accounts) => {
      const currentAccount = web3.utils.toChecksumAddress(accounts[0]);

      this.setState({ currentAccount }, async () => {
        const hasFundsToWithdraw = await crowdfunding.methods
          .isRefundAvailable()
          .call({
            from: this.state.currentAccount,
          });

        const isBanned = await crowdfunding.methods
          .bannedEntrepreneurs(currentAccount)
          .call();

        this.setState({ hasFundsToWithdraw, isBanned });

        this.retrieveCampaigns();
      });
    });

    crowdfunding.events.CampaignCreated().on("data", async (data) => {
      console.log(
        data.returnValues.campaignId,
        data.returnValues.entrepreneur,
        data.returnValues.title
      );

      this.retrieveCampaigns();

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      this.setState({ balance });
    });

    crowdfunding.events.PledgeMade().on("data", async (data) => {
      console.log(
        data.returnValues.campaignId,
        data.returnValues.backer,
        data.returnValues.amount
      );

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      this.setState({ balance });

      this.retrieveCampaigns();
    });

    crowdfunding.events.CampaignCompleted().on("data", async (data) => {
      console.log(data.returnValues.campaignId);

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      const collectedFees = web3.utils.fromWei(
        await crowdfunding.methods.totalPlatformFees().call(),
        "ether"
      );

      this.setState({ balance, collectedFees });
      this.retrieveCampaigns();
    });

    crowdfunding.events.CampaignCanceled().on("data", async (data) => {
      console.log(data.returnValues.campaignId);

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      const hasFundsToWithdraw = await crowdfunding.methods
        .isRefundAvailable()
        .call({
          from: this.state.currentAccount,
        });

      const collectedFees = web3.utils.fromWei(
        await crowdfunding.methods.totalPlatformFees().call(),
        "ether"
      );

      this.setState({ hasFundsToWithdraw, balance, collectedFees });
      this.retrieveCampaigns();
    });

    crowdfunding.events.EntrepreneurBanned().on("data", async (data) => {
      console.log(data.returnValues.entrepreneur);
      if (
        this.state.currentAccount &&
        this.state.currentAccount ===
          web3.utils.toChecksumAddress(data.returnValues.entrepreneur)
      ) {
        const isBanned = true;
        this.setState({ isBanned });
      }
    });

    crowdfunding.events.OwnershipChanged().on("data", async (data) => {
      console.log(data.returnValues.newOwner);
      const owner = web3.utils.toChecksumAddress(data.returnValues.newOwner);
      this.setState({ owner });
    });

    crowdfunding.events.ContractTerminated().on("data", async (data) => {
      this.retrieveCampaigns();

      const hasFundsToWithdraw = await crowdfunding.methods
        .isRefundAvailable()
        .call({
          from: this.state.currentAccount,
        });

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      const collectedFees = web3.utils.fromWei(
        await crowdfunding.methods.totalPlatformFees().call(),
        "ether"
      );

      this.setState({
        terminated: true,
        balance,
        collectedFees,
        hasFundsToWithdraw,
      });
    });

    crowdfunding.events.PlatformFeesWithdrawn().on("data", async (data) => {
      console.log(data.returnValues.amount);

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      this.setState({
        balance,
        collectedFees: 0n,
      });
    });

    crowdfunding.events.InvestorRefunded().on("data", async (data) => {
      console.log(data.returnValues.investor, data.returnValues.amount);
      this.setState({ hasFundsToWithdraw: false });

      const balance = web3.utils.fromWei(
        await web3.eth.getBalance(crowdfunding.options.address),
        "ether"
      );

      this.retrieveCampaigns();

      this.setState({ balance });
    });
  }

  createCampaign = async () => {
    try {
      if (
        !this.state.campaignTitle ||
        !this.state.campaignCost ||
        !this.state.campaignPledges
      ) {
        return;
      } else if (
        await crowdfunding.methods
          .campaignTitles(this.state.campaignTitle)
          .call()
      ) {
        const input = document.getElementById("titleInput");
        input.style.color = "red";
        this.setState({
          campaignNotValid: true,
        });
        return;
      } else if (Number(this.state.campaignCost) <= 0) {
        const input = document.getElementById("costInput");
        input.style.color = "red";
        this.setState({
          campaignNotValid: true,
        });
        return;
      } else if (
        !Number.isInteger(Number(this.state.campaignPledges)) ||
        this.state.campaignPledges <= 0
      ) {
        const input = document.getElementById("numberOfPledgesInput");
        input.style.color = "red";
        this.setState({
          campaignNotValid: true,
        });
        return;
      }

      await crowdfunding.methods
        .createCampaign(
          this.state.campaignTitle,
          web3.utils.toWei(this.state.campaignCost, "ether"),
          this.state.campaignPledges
        )
        .send({
          from: this.state.currentAccount,
          value: this.state.campaignFee,
        });

      this.setState({
        campaignTitle: "",
        campaignCost: "",
        campaignPledges: "",
      });
    } catch (error) {
      console.log(error);
    }
  };

  pledge = async (campaignId, pledgeCost) => {
    try {
      if (!campaignId) {
        return;
      }

      const campaign = await crowdfunding.methods
        .getCampaignInfoById(campaignId)
        .call({ from: this.state.currentAccount });

      if (campaign.fulfilled || campaign.canceled) {
        return;
      }

      await crowdfunding.methods
        .fundCampaign(campaignId, 1)
        .send({ from: this.state.currentAccount, value: pledgeCost });
    } catch (error) {
      console.log(error);
    }
  };

  fulfill = async (campaignId) => {
    try {
      if (!campaignId) {
        return;
      }

      const campaign = await crowdfunding.methods
        .getCampaignInfoById(campaignId)
        .call({ from: this.state.currentAccount });
      if (campaign.fulfilled || campaign.canceled) {
        return;
      }

      await crowdfunding.methods
        .completeCampaign(campaignId)
        .send({ from: this.state.currentAccount });
    } catch (error) {
      console.log(error);
    }
  };

  cancel = async (campaignId) => {
    try {
      if (!campaignId) {
        return;
      }

      const campaign = await crowdfunding.methods
        .getCampaignInfoById(campaignId)
        .call({ from: this.state.currentAccount });
      if (campaign.fulfilled || campaign.canceled) {
        return;
      }

      await crowdfunding.methods
        .cancelCampaign(campaignId)
        .send({ from: this.state.currentAccount });
    } catch (error) {
      console.log(error);
    }
  };

  refund = async () => {
    try {
      await crowdfunding.methods
        .refundInvestor()
        .send({ from: this.state.currentAccount });
    } catch (error) {
      console.log(error);
    }
  };

  withdraw = async () => {
    try {
      await crowdfunding.methods.withdrawPlatformFees().send({
        from: this.state.currentAccount,
      });
    } catch (error) {
      console.log(error);
    }
  };

  changeOwner = async () => {
    try {
      const validNewOwner = web3.utils.toChecksumAddress(
        this.state.newOnwerAddress
      );
      await crowdfunding.methods.changeOwnership(validNewOwner).send({
        from: this.state.currentAccount,
      });
      this.setState({ newOnwerAddress: "" });
    } catch (error) {
      console.log(error);
    }
  };

  banEntrepreneur = async () => {
    try {
      const validAddress = web3.utils.toChecksumAddress(
        this.state.banEntrepreneurAddress
      );
      await crowdfunding.methods.banEntrepreneur(validAddress).send({
        from: this.state.currentAccount,
      });
      this.setState({ banEntrepreneurAddress: "" });
    } catch (error) {
      console.log(error);
    }
  };

  destroyContract = async () => {
    try {
      await crowdfunding.methods.terminateContract().send({
        from: this.state.currentAccount,
      });
    } catch (error) {
      console.log(error);
    }
  };

  liveCampaignsList = () => {
    return (
      <>
        {this.state.liveCampaigns.map((campaign, index) => (
          <tr key={index}>
            <td>{campaign.entrepreneur}</td>
            <td>{campaign.title}</td>
            <td style={{ textAlign: "right" }}>
              {web3.utils.fromWei(campaign.price, "ether")}
            </td>
            <td style={{ textAlign: "right" }}>{campaign.backers}</td>
            <td style={{ textAlign: "right" }}> {campaign.pledgesLeft}</td>
            <td style={{ textAlign: "right" }}> {campaign.callerPledges}</td>
            <td>
              <div>
                <button
                  type="button"
                  className="btn btn-success btn-sm me-2"
                  onClick={() => {
                    this.pledge(campaign.campaignId, campaign.price);
                  }}
                >
                  Pledge
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm me-2"
                  style={{
                    visibility:
                      campaign.entrepreneur === this.state.currentAccount ||
                      this.state.currentAccount === this.state.owner ||
                      this.state.currentAccount === this.state.specialWallet
                        ? "visible"
                        : "hidden",
                  }}
                  onClick={() => {
                    this.cancel(campaign.campaignId, campaign.price);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-warning btn-sm me-2"
                  disabled={campaign.pledgesLeft !== 0n}
                  style={{
                    visibility:
                      campaign.entrepreneur === this.state.currentAccount ||
                      this.state.currentAccount === this.state.owner ||
                      this.state.currentAccount === this.state.specialWallet
                        ? "visible"
                        : "hidden",
                  }}
                  onClick={() => {
                    this.fulfill(campaign.campaignId, campaign.price);
                  }}
                >
                  Fulfill
                </button>
              </div>
            </td>
          </tr>
        ))}
      </>
    );
  };

  canceledOrFulfilledCampaignsList = (canceled) => {
    if (canceled) {
      return (
        <>
          {this.state.canceledCampaigns.map((campaign, index) => (
            <tr key={index}>
              <td>{campaign.entrepreneur}</td>
              <td>{campaign.title}</td>
              <td style={{ textAlign: "right" }}>
                {web3.utils.fromWei(campaign.price, "ether")}
              </td>
              <td style={{ textAlign: "right" }}>{campaign.backers}</td>
              <td style={{ textAlign: "right" }}> {campaign.pledgesLeft}</td>
              <td style={{ textAlign: "right" }}> {campaign.callerPledges}</td>
            </tr>
          ))}
        </>
      );
    } else {
      return (
        <>
          {this.state.fulfilledCampaigns.map((campaign, index) => (
            <tr key={index}>
              <td>{campaign.entrepreneur}</td>
              <td>{campaign.title}</td>
              <td style={{ textAlign: "right" }}>
                {web3.utils.fromWei(campaign.price, "ether")}
              </td>
              <td style={{ textAlign: "right" }}>{campaign.backers}</td>
              <td style={{ textAlign: "right" }}> {campaign.pledgesLeft}</td>
              <td style={{ textAlign: "right" }}> {campaign.callerPledges}</td>
            </tr>
          ))}
        </>
      );
    }
  };

  render() {
    return (
      <div>
        <div className="ms-2">
          <h2 className="font-weight-bold">Crowdfunding DApp</h2>
          <table className="table table-borderless w-auto align-middle">
            <tbody>
              <tr>
                <td style={{ textAlign: "right" }}>Current Address</td>
                <td>
                  <input
                    type="text"
                    className="form-control"
                    value={this.state.currentAccount}
                    onChange={(event) =>
                      this.setState({ currentAccount: event.target.value })
                    }
                    readOnly
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right" }} className="align-middle">
                  Owner's Address
                </td>
                <td>
                  <input
                    type="text"
                    value={this.state.owner}
                    className="form-control"
                    onChange={(event) =>
                      this.setState({ owner: event.target.value })
                    }
                    readOnly
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right" }} className="align-middle">
                  Balance
                </td>
                <td>
                  <input
                    type="text"
                    value={
                      this.state.balance ? parseFloat(this.state.balance) : 0
                    }
                    className="form-control"
                    onChange={(event) =>
                      this.setState({ balance: event.target.value })
                    }
                    readOnly
                  />
                </td>
                <td style={{ textAlign: "right" }} className="align-middle">
                  Collected fees
                </td>
                <td>
                  <input
                    type="text"
                    value={
                      this.state.collectedFees
                        ? parseFloat(this.state.collectedFees)
                        : 0
                    }
                    className="form-control"
                    onChange={(event) =>
                      this.setState({ collectedFees: event.target.value })
                    }
                    readOnly
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <hr />
        <div className="ms-2">
          <h2 className="font-weight-bold">New Campaign</h2>
          <table className="table table-borderless w-auto">
            <tbody>
              <tr>
                <td style={{ textAlign: "right" }} className="align-middle">
                  Title
                </td>
                <td>
                  <input
                    id="titleInput"
                    style={{ boxSizing: "content-box" }}
                    type="text"
                    className="form-control"
                    placeholder="Campaign's id"
                    disabled={
                      this.state.currentAccount === this.state.owner ||
                      this.state.isBanned ||
                      this.state.terminated
                    }
                    value={this.state.campaignTitle}
                    onChange={(event) => {
                      event.target.style.color = "black";
                      this.setState({
                        campaignTitle: event.target.value,
                        campaignNotValid: false,
                      });
                    }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right" }} className="align-middle">
                  Pledge Cost
                </td>
                <td>
                  <input
                    id="costInput"
                    style={{ boxSizing: "content-box" }}
                    type="number"
                    className="form-control"
                    placeholder="Cost"
                    disabled={
                      this.state.currentAccount === this.state.owner ||
                      this.state.isBanned ||
                      this.state.terminated
                    }
                    value={this.state.campaignCost}
                    onChange={(event) => {
                      event.target.style.color = "black";
                      this.setState({
                        campaignCost: event.target.value,
                        campaignNotValid: false,
                      });
                    }}
                  />
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: "right" }} className="align-middle">
                  Number of Pledges
                </td>
                <td>
                  <input
                    id="numberOfPledgesInput"
                    style={{
                      boxSizing: "content-box",
                    }}
                    type="number"
                    step="1"
                    className="form-control"
                    placeholder="Pledges"
                    disabled={
                      this.state.currentAccount === this.state.owner ||
                      this.state.isBanned ||
                      this.state.terminated
                    }
                    value={this.state.campaignPledges}
                    onChange={(event) => {
                      event.target.style.color = "black";
                      this.setState({
                        campaignPledges: event.target.value,
                        campaignNotValid: false,
                      });
                    }}
                  />
                </td>
              </tr>
              <tr>
                <td></td>
                <td>
                  <button
                    onClick={this.createCampaign}
                    disabled={
                      this.state.currentAccount === this.state.owner ||
                      this.state.isBanned ||
                      !this.state.campaignTitle ||
                      !this.state.campaignCost ||
                      !this.state.campaignPledges ||
                      this.state.terminated ||
                      this.state.campaignNotValid
                    }
                    className="btn btn-primary btn-sm"
                  >
                    Create
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <hr />
        <div className="ms-2">
          <h2 className="font-weight-bold">Live Campaigns</h2>
          <table className="table table-borderless w-auto">
            <thead>
              <tr>
                <th>Entrepreneur</th>
                <th>Title</th>
                <th>Price</th>
                <th>Backers</th>
                <th>Pledges Left</th>
                <th>Your Pledges</th>
              </tr>
            </thead>
            <tbody>{this.liveCampaignsList()}</tbody>
          </table>
        </div>
        <hr />
        <div className="ms-2">
          <h2 className="font-weight-bold">Fulfilled Campaigns</h2>
          <table className="table table-borderless w-auto">
            <thead>
              <tr>
                <th>Entrepreneur</th>
                <th>Title</th>
                <th>Price</th>
                <th>Backers</th>
                <th>Pledges Left</th>
                <th>Your Pledges</th>
              </tr>
            </thead>
            <tbody>{this.canceledOrFulfilledCampaignsList(false)}</tbody>
          </table>
        </div>
        <hr />
        <div className="ms-2">
          <div className="d-flex align-items-center">
            <h2 className="me-3 font-weight-bold">Canceled Campaigns</h2>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!this.state.hasFundsToWithdraw}
              onClick={this.refund}
            >
              Claim
            </button>
          </div>
          <table className="table table-borderless w-auto">
            <thead>
              <tr>
                <th>Entrepreneur</th>
                <th>Title</th>
                <th>Price</th>
                <th>Backers</th>
                <th>Pledges Left</th>
                <th>Your Pledges</th>
              </tr>
            </thead>
            <tbody>{this.canceledOrFulfilledCampaignsList(true)}</tbody>
          </table>
        </div>
        <hr />
        <div className="ms-2">
          <h2 className="font-weight-bold">Control Panel</h2>
          <table className="table table-borderless w-auto">
            <tbody>
              <tr>
                <td>
                  <button
                    onClick={this.withdraw}
                    disabled={
                      this.state.collectedFees <= 0 ||
                      !(
                        this.state.currentAccount === this.state.owner ||
                        this.state.currentAccount === this.state.specialWallet
                      )
                    }
                    className="btn btn-light btn-sm"
                  >
                    Withdraw
                  </button>
                </td>
              </tr>
              <tr>
                <td>
                  <button
                    onClick={this.changeOwner}
                    disabled={
                      (this.state.currentAccount !== this.state.owner &&
                        this.state.currentAccount !==
                          this.state.specialWallet) ||
                      this.state.terminated ||
                      !this.state.newOnwerAddress
                    }
                    className="btn btn-light btn-sm"
                  >
                    Change owner
                  </button>
                </td>
                <td>
                  <input
                    style={{ boxSizing: "content-box" }}
                    type="text"
                    className="form-control"
                    placeholder="Enter new owner's wallet address"
                    disabled={
                      (this.state.currentAccount !== this.state.owner &&
                        this.state.currentAccount !==
                          this.state.specialWallet) ||
                      this.state.terminated
                    }
                    value={this.state.newOnwerAddress}
                    onChange={(event) =>
                      this.setState({ newOnwerAddress: event.target.value })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <button
                    onClick={this.banEntrepreneur}
                    disabled={
                      (this.state.currentAccount !== this.state.owner &&
                        this.state.currentAccount !==
                          this.state.specialWallet) ||
                      this.state.terminated ||
                      !this.state.banEntrepreneurAddress
                    }
                    className="btn btn-light btn-sm"
                  >
                    Banned Entrepreneur
                  </button>
                </td>
                <td>
                  <input
                    style={{ boxSizing: "content-box" }}
                    type="text"
                    className="form-control"
                    placeholder="Enter entrepreneur's address"
                    disabled={
                      (this.state.currentAccount !== this.state.owner &&
                        this.state.currentAccount !==
                          this.state.specialWallet) ||
                      this.state.terminated
                    }
                    value={this.state.banEntrepreneurAddress}
                    onChange={(event) =>
                      this.setState({
                        banEntrepreneurAddress: event.target.value,
                      })
                    }
                  />
                </td>
              </tr>
              <tr>
                <td>
                  <button
                    onClick={this.destroyContract}
                    disabled={
                      (this.state.currentAccount !== this.state.owner &&
                        this.state.currentAccount !==
                          this.state.specialWallet) ||
                      this.state.terminated
                    }
                    className="btn btn-light btn-sm"
                  >
                    Destroy
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}

export default App;
