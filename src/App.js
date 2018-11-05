import React, { Component } from 'react';
import Web3 from 'web3';
import contractInterface from './interfaces/UnidirectionalPaymentChannelInterface';
import './App.css';

const contractAddress = '0xf9e1c55416d8c9b76a8d550da5d6046c6091deef'
let web3;
let channelContract;

class App extends Component {
  state = {
    openPaymentRecipient: '',
    openPaymentAmount: '',
    senderChannels: [],
    paymentAmountEth: '0.005'
  }

  componentDidMount() {
    this.initWeb3();
  }

  initWeb3() {
    if (typeof window.web3 !== 'undefined') {
      web3 = new Web3(window.web3.currentProvider);
      window.web3 = web3;
      this.loadContractInterface();
    } else {
      alert('no web3')
    }
  }

  loadContractInterface() {
    channelContract = new web3.eth.Contract(
      contractInterface,
      contractAddress
    );
    this.getSenderChannels();
  }

  async getSenderChannels() {
    const from = await web3.eth.getAccounts();

    const channelCount = await channelContract.methods
      .senderChannelIndex(from[0]).call()

    if (channelCount < 1) return;

    // fetch channel data from contract
    const senderChannels = []
    for (let i = 0; i < channelCount; i++) {
      let result = await channelContract.methods
        .senderChannels(from[0], i).call()
      senderChannels.push(result)
    }

    this.setState({ senderChannels })
  }

  async openChannel(e) {
    e.preventDefault();
    const { openPaymentRecipient, openPaymentAmount } = this.state;
    const value = web3.utils.toWei(openPaymentAmount, 'ether');
    const accounts = await web3.eth.getAccounts();

    channelContract.methods
      .openChannel(openPaymentRecipient)
      .send({ from: accounts[0], value })
      .then(receipt => this.getSenderChannels())
  }

  async initPayment(channelId) {
    const { paymentAmountEth } = this.state;
    const amount = web3.utils.toWei(paymentAmountEth, 'ether');
    const accounts = await web3.eth.getAccounts();

    const previousChannelSpend = this.getPreviousChannelSpend(channelId)

    const channelSpend = (parseInt(amount) + parseInt(previousChannelSpend)).toString();
    const message = this.constructPaymentMessage(channelSpend, channelId);
    const signature = await this.signPaymentMessage(message);

    const paymentEntry = {
      channelId,
      channelSpend,
      signature,
      spenderAddress: accounts[0]
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
    const accounts = await web3.eth.getAccounts();
    const signedMessage = await web3.eth.personal.sign(message, accounts[0])
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
    localStorage.setItem('payments', JSON.stringify(paymentStorage))
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

  render() {
    const {
      openPaymentRecipient,
      openPaymentAmount,
      senderChannels,
      paymentAmountEth
    } = this.state;

    return(
      <div>
        <h1>Open payment channel</h1>
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

          <button onClick={e => this.openChannel(e)}>
            Open Channel
          </button>
        </form>

        <hr/>

        <h1>Sender channels</h1>
        {
          senderChannels.length > 0 &&
          <div>
            {
              senderChannels.map(channel => (
                <div>
                  {channel.id} &nbsp;
                  { web3.utils.fromWei(this.getPreviousChannelSpend(channel.id).toString()) } &nbsp; / &nbsp;
                  { web3.utils.fromWei(channel.deposit.toString(), 'ether') } Eth &nbsp;
                  {channel.recipient} &nbsp;
                  <button onClick={() => this.initPayment(channel.id)}>
                    make a payment { paymentAmountEth } ETH
                  </button>
                  <button
                    onClick={() => this.verifySignature(channel.id)}
                    disabled={this.getPreviousChannelSpend(channel.id) === 0}>
                    verify signature
                  </button>
                </div>
              ))
            }
          </div>
        }
        {
          !senderChannels.length &&
          <div>
            no channels
          </div>
        }
      </div>
    )
  }

}

export default App
