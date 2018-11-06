import React, { Component } from 'react';
import Web3 from 'web3';

import contractInterface from './interfaces/UnidirectionalPaymentChannelInterface';
import './App.css';

// rinkeby network
const contractAddress = '0x4b5614a05fe4a1d212d2d66573909342e5648c1c'
let web3;
let channelContract;

const initialState = {
  address: '',
  openPaymentRecipient: '',
  openPaymentAmount: '',
  senderChannels: [],
  recipientChannels: [],
  paymentAmountEth: '0.01',
  status: 'ready'
}

class App extends Component {
  state = Object.assign({}, initialState);

  componentDidMount() {
    this.initWeb3();
  }

  initWeb3() {
    if (typeof window.web3 !== 'undefined') {
      web3 = new Web3(window.web3.currentProvider);
      window.web3 = web3;
      return this.loadContractInterface();
    } else {
      alert('no web3')
    }
  }

  loadContractInterface() {
    channelContract = new web3.eth.Contract(
      contractInterface,
      contractAddress
    );

    return this.setAccount();
  }

  async setAccount() {
    const accounts = await web3.eth.getAccounts();
    if (!accounts[0]) return;

    const address = accounts[0].toLowerCase();

    this.setState({ address }, () => {
      this.getSenderChannels();
      this.getRecipientChannels();

      web3.currentProvider.publicConfigStore
        .on('update', args => this.refreshAccount(args));
    })
  }

  refreshAccount({ selectedAddress }) {
    const { address } = this.state;

    if (selectedAddress === address) return;

    const state = Object.assign({}, initialState);
    this.setState(state, () => this.setAccount());
  }

  async getSenderChannels() {
    const { address } = this.state;

    const channelCount = await channelContract.methods
      .senderChannelIndex(address).call()

    if (channelCount < 1) return;

    // fetch channel data from contract
    const senderChannels = []
    for (let i = 0; i < channelCount; i++) {
      let channelIndex = await channelContract.methods
        .senderChannels(address, i).call()

      let channel = await channelContract.methods
        .channels(channelIndex).call()

      senderChannels.push(channel)
    }

    this.setState({ senderChannels })
  }

  async getRecipientChannels() {
    const { address } = this.state;
    const channelCount = await channelContract.methods
      .recipientChannelIndex(address).call()

    if (channelCount < 1) return;

    const recipientChannels = []
    for (let i = 0; i < channelCount; i++) {
      let channelIndex = await channelContract.methods
        .recipientChannels(address, i).call()

      // KLUDGE => use pointers inside contract
      let channel = await channelContract.methods
        .channels(channelIndex).call()

      recipientChannels.push(channel)
    }

    this.setState({ recipientChannels })
  }

  async openChannel(e) {
    e.preventDefault();
    const { openPaymentRecipient, openPaymentAmount, address } = this.state;
    const value = web3.utils.toWei(openPaymentAmount, 'ether');

    this.setState({ status: 'busy' });

    channelContract.methods
      .openChannel(openPaymentRecipient)
      .send({ from: address, value })
      .then(receipt => {
        this.getSenderChannels();
        this.setState({ status: 'ready' });
      });
  }

  async initPayment(channelId) {
    const { paymentAmountEth, address } = this.state;
    const amount = web3.utils.toWei(paymentAmountEth, 'ether');
    const previousChannelSpend = this.getPreviousChannelSpend(channelId)

    const channelSpend = (
      parseInt(amount) + parseInt(previousChannelSpend)
    ).toString();

    const message = this.constructPaymentMessage(channelSpend, channelId);
    const signature = await this.signPaymentMessage(message);

    const paymentEntry = {
      channelId,
      channelSpend,
      signature,
      spenderAddress: address
    }

    this.storePayment(paymentEntry)
  }

  constructPaymentMessage(channelSpend, channelId) {
    return web3.utils.soliditySha3(
      { t: 'uint256', v: channelSpend },
      { t: 'uint256', v: channelId },
    )
  }

  async signPaymentMessage(message) {
    const { address } = this.state;
    const signedMessage = await web3.eth.personal.sign(message, address);
    return signedMessage;
  }

  getPreviousChannelSpend(channelId) {
    if (!localStorage.getItem('payments')) {
      localStorage.setItem('payments', JSON.stringify({}))
      return 0;
    }

    const storedPayments = JSON.parse(localStorage.getItem('payments'));

    const previousSpend = storedPayments[channelId] ?
      storedPayments[channelId].channelSpend : 0;

    return previousSpend.toString();
  }

  storePayment(paymentEntry) {
    // update payment object from storage
    const paymentStorage = localStorage.getItem('payments') ?
      Object.assign({}, JSON.parse(localStorage.getItem('payments'))) : {};

    paymentStorage[paymentEntry.channelId] = paymentEntry;
    localStorage.setItem('payments', JSON.stringify(paymentStorage));
    this.getSenderChannels();
  }

  async verifySignature(channelId) {
    const storedPayment = JSON.parse(localStorage.getItem('payments'))[channelId];
    const { channelSpend, signature, spenderAddress } = storedPayment;

    const expectedMessage = this.constructPaymentMessage(channelSpend, channelId);
    const signingAddress = await web3.eth.personal.ecRecover(expectedMessage, signature);

    if (signingAddress.toLowerCase() === spenderAddress.toLowerCase())
      return alert('payment signature is valid. Signed by: ' + signingAddress + ' for ' + channelSpend);

    alert('payment signature invalid')
  }

  async closeChannel(channelId) {
    const { address } = this.state;

    const paymentStore = localStorage.getItem('payments') ?
      Object.assign({}, JSON.parse(localStorage.getItem('payments'))) : {};

    if (!paymentStore[channelId]) return;

    const {
      channelSpend,
      signature,
      spenderAddress
    } = paymentStore[channelId];

    this.setState({ status: 'busy' });

    channelContract.methods
      .closeChannel(channelSpend, channelId, signature, spenderAddress)
      .send({ from: address })
      .then(receipt => {
        this.setState({ status: 'ready' });
        if (receipt.status === true) {
          this.getSenderChannels();
          this.getRecipientChannels();
        }
      });
  }

  render() {
    const {
      address,
      openPaymentRecipient,
      openPaymentAmount,
      senderChannels,
      recipientChannels,
      paymentAmountEth,
      status
    } = this.state;

    return(
      <div className="App">

        {
          !address &&
          <div className="App__overlay">
            <h3>Please sign into MetaMask</h3>
            <h1>psss.. test on rinkeby network</h1>
          </div>
        }

        {
          status === 'busy' &&
          <div className="App__overlay">
            <h3>Blockchaining, please wait..</h3>
            <h1>this is why we need channels XD</h1>
            <h3>Please confirm with your metamask wallet</h3>
          </div>
        }

        <div className="App__header">
          <h1>++</h1>
          <p>signed in: { address }</p>
        </div>

        <div className="App__container">
          <h4>Open payment channel</h4>
          <form>
            <label>
              Enter Channel Recipient
              <input
                type="text"
                placeholder="recipient address 0x.."
                value={openPaymentRecipient}
                onChange={e => this.setState({ openPaymentRecipient: e.target.value })} />
            </label>

            <label>
              Enter Channel Value
              <input
                type="text"
                placeholder="amount in ETH"
                value={openPaymentAmount}
                onChange={e => this.setState({ openPaymentAmount: e.target.value })} />
            </label>

            <button className="App__button--primary" onClick={e => this.openChannel(e)}>
              Open Channel
            </button>
          </form>

          <br/>
          <hr/>

          <h4>Sender channels</h4>
          <form>
            <label>
              Enter Payment Amount
              <input
                type="text"
                placeholder="amount in ETH"
                value={paymentAmountEth}
                onChange={e => this.setState({ paymentAmountEth: e.target.value })} />
            </label>
          </form>

          <br/>

          {
            senderChannels.length > 0 &&
            <div>
              {
                senderChannels.map(channel => (
                  <div key={channel.id}>
                    { web3.utils.fromWei(this.getPreviousChannelSpend(channel.id).toString()) } &nbsp; | &nbsp;
                    { web3.utils.fromWei(channel.deposit.toString(), 'ether') } ETH &nbsp;
                    {channel.recipient} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

                    {
                      channel.status === 'closed' &&
                      <span>closed</span>
                    }

                    {
                      channel.status === 'open' &&
                      <span>
                        <button
                          className="App__button--secondary"
                          onClick={() => this.initPayment(channel.id)}>
                          pay { paymentAmountEth } ETH
                        </button>
                        <button
                          className="App__button--secondary"
                          onClick={() => this.verifySignature(channel.id)}
                          disabled={this.getPreviousChannelSpend(channel.id) === 0}>
                          verify
                        </button>
                      </span>
                    }

                    <br/><br/>

                  </div>
                ))
              }
            </div>
          }
          {
            !senderChannels.length &&
            <div>
              -
            </div>
          }

          <br/>
          <hr/>

          <h4>Recieving channels</h4>
          {
            recipientChannels.length > 0 &&
            <div>
              {
                recipientChannels.map(channel => (
                  <div key={channel.id}>
                    { web3.utils.fromWei(this.getPreviousChannelSpend(channel.id).toString()) } &nbsp; | &nbsp;
                    { web3.utils.fromWei(channel.deposit.toString(), 'ether') } ETH &nbsp;
                    {channel.sender} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

                    {
                      channel.status === 'closed' &&
                      <span>closed</span>
                    }

                    {
                      channel.status === 'open' &&
                      <span>
                        <button
                          className="App__button--secondary"
                          onClick={() => this.verifySignature(channel.id)}
                          disabled={this.getPreviousChannelSpend(channel.id) === 0}>
                          verify
                        </button>

                        <button
                          className="App__button--secondary"
                          onClick={() => this.closeChannel(channel.id)}
                          disabled={this.getPreviousChannelSpend(channel.id) === 0}>
                          close channel
                        </button>
                      </span>
                    }

                    <br/><br/>

                  </div>
                ))
              }
            </div>
          }
          {
            !recipientChannels.length &&
            <div>
              -
            </div>
          }
        </div>
      </div>
    )
  }

}

export default App
