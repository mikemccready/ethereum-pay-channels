import React, { Component } from 'react';
import Web3 from 'web3';
import contractInterface from '../interfaces/UnidirectionalPaymentChannelInterface';

// import components
import Header from '../components/Header/Header';
import Overlay from '../components/Overlay/Overlay';
import ChannelForm from '../components/ChannelForm/ChannelForm';
import ChannelItem from '../components/ChannelItem/ChannelItem';

// import styles
import './App.css';

// init global variables
let web3;
let channelContract;
const contractAddress = '0x82293d50e12d580db85d4488f8f3c7f2d5ed8d20';

// define default state
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

  initWeb3 = () => {
    // check for web3 provider, initialize web3
    if (typeof window.web3 !== 'undefined') {
      web3 = new Web3(window.web3.currentProvider);
      window.web3 = web3;

      this.handleAccountUpdate();
      this.loadContractInterface();
    } else {
      // oh no, web3 not found
      alert(
        `
        Please download metamask extension and sign-in
        to continue.
        `
      );
    }
  }

  loadContractInterface = () => {
    // init contract interface
    channelContract = new web3.eth.Contract(contractInterface, contractAddress);
    this.setAccount();
  }

  handleAccountUpdate = () => {
    // listen for account changes
    web3.currentProvider.publicConfigStore
      .on('update', args => this.refreshAccount(args));
  }


  setAccount = async () => {
    // get accounts list from web3
    const accounts = await web3.eth.getAccounts();
    // if no accounts found => stop
    if (!accounts[0]) return;
    // set the active account
    const address = accounts[0].toLowerCase();

    // update state with new account
    // get user channels from contract
    this.setState({ address }, () => {
      this.getSenderChannels();
      this.getRecipientChannels();
    })
  }

  refreshAccount = ({ selectedAddress }) => {
    const { address } = this.state;
    // if address is current => stop
    if (selectedAddress === address) return;

    // if address has updated, reset state and account
    const newState = Object.assign({}, initialState);
    this.setState(newState, () => this.setAccount());
  }

  getSenderChannels = async () => {
    const contractChannels = await this.getContractChannels(
      // sender channel count
      channelContract.methods.senderChannelIndex,
      // sender channel indexes, point to main channel mapping
      channelContract.methods.senderChannels,
    );

    this.setState({ senderChannels: contractChannels })
  }

  getRecipientChannels = async () => {
    const contractChannels = await this.getContractChannels(
      // recipient channel count
      channelContract.methods.recipientChannelIndex,
      // recipient channel indexes, point to main channel mapping
      channelContract.methods.recipientChannels,
    );

    this.setState({ recipientChannels: contractChannels })
  }

  getContractChannels = async (getChannelCount, getChannelIndex) => {
    const { address } = this.state;
    const { channels } = channelContract.methods;
    const contractChannels = []

    // get channel count for sender/recipient
    const channelCount = await getChannelCount(address).call();
    if (channelCount < 1) return [];

    for (let i = 0; i < channelCount; i++) {
      // get channel indexes from sender/recipient mapping
      let channelIndex = await getChannelIndex(address, i).call();
      // indexes point to main channel map
      let channel = await channels(channelIndex).call();
      contractChannels.push(channel)
    }
    return contractChannels;
  }

  openChannel = async () => {
    const {
      openPaymentRecipient,
      openPaymentAmount,
      address
    } = this.state;

    // convert amount to units eth
    const value = web3.utils.toWei(openPaymentAmount, 'ether');
    // set ui status 'busy' for blockchain waiting entertainment
    this.setState({ status: 'busy' });

    // call openChannel contract method
    channelContract.methods
      .openChannel(openPaymentRecipient)
      .send({ from: address, value })
      .then(receipt => {
        this.getSenderChannels();
        this.setState({ status: 'ready' });
      });
  }

  initPayment = async channelId => {
    const { paymentAmountEth, address } = this.state;
    const amount = web3.utils.toWei(paymentAmountEth, 'ether');

    // get previous spend balance
    const previousChannelSpend = this.getPreviousChannelSpend(channelId);
    // add current pay amount and previousSpend
    const channelSpend = (parseInt(amount) + parseInt(previousChannelSpend)).toString();
    // hash a message with updated channelSpend and channelId
    const message = this.constructPaymentMessage(channelSpend, channelId);
    // sign the hashed message with metamask wallet
    const signature = await this.signPaymentMessage(message);

    // construct payment entry for localStorage
    const paymentEntry = {
      channelId,
      channelSpend,
      signature,
      spenderAddress: address
    }

    this.storePayment(paymentEntry)
  }

  constructPaymentMessage = (channelSpend, channelId) => (
    // hash channelSpend and channelId
    web3.utils.soliditySha3(
      { t: 'uint256', v: channelSpend },
      { t: 'uint256', v: channelId },
    )
  )

  signPaymentMessage = async message => {
    const { address } = this.state;
    // sign the message hash
    const signedMessage = await web3.eth.personal.sign(message, address);
    return signedMessage;
  }

  getPreviousChannelSpend = channelId => {
    // if no payment record found => 0
    if (!localStorage.getItem('payments')) return '0';

    const storedPayments = JSON.parse(localStorage.getItem('payments'));
    // get channel record from stored payment data
    const previousSpend = storedPayments[channelId] ? storedPayments[channelId].channelSpend : 0;
    return previousSpend.toString();
  }

  storePayment = paymentEntry => {
    // prep localStorage payments object
    const paymentStorage = localStorage.getItem('payments') ?
      Object.assign({}, JSON.parse(localStorage.getItem('payments'))) : {};

    // add new entry to channel
    paymentStorage[paymentEntry.channelId] = paymentEntry;
    localStorage.setItem('payments', JSON.stringify(paymentStorage));
    this.getSenderChannels();
  }

  verifySignature = async channelId => {
    // get payment record from localStorage
    const storedPayment = JSON.parse(localStorage.getItem('payments'))[channelId];
    const { channelSpend, signature, spenderAddress } = storedPayment;

    // recreate the expected message hash
    const expectedMessage = this.constructPaymentMessage(channelSpend, channelId);
    // recover signer's address from expected message hash and the recorded signature
    const signingAddress = await web3.eth.personal.ecRecover(expectedMessage, signature);

    // compare recovered address with expected signer's address
    if (signingAddress.toLowerCase() === spenderAddress.toLowerCase()) {
      return alert('payment signature is valid. Signed by: ' + signingAddress + ' for ' + channelSpend);
    } else {
      alert('payment signature invalid');
    }
  }

  closeChannel = async channelId => {
    const { address } = this.state;
    // get payment record
    const paymentStore = localStorage.getItem('payments') ?
      Object.assign({}, JSON.parse(localStorage.getItem('payments'))) : {};

    // no channel data => stop
    if (!paymentStore[channelId]) return;

    const {
      channelSpend,
      signature,
      spenderAddress
    } = paymentStore[channelId];

    // set ui state to busy while we wait for on-chain tx
    this.setState({ status: 'busy' });

    // execute closing function
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

  handleFormChange = (field, value) => {
    // update state with form data
    const newState = {};
    newState[field] = value;
    this.setState(newState);
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
        <Header address={address} />
        <div className="App__container">
          <h4>Open payment channel</h4>
          <ChannelForm
            openPaymentRecipient={openPaymentRecipient}
            openPaymentAmount={openPaymentAmount}
            handleFormChange={this.handleFormChange}
            openChannel={this.openChannel}
          />

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

          {
            senderChannels.length > 0 ?
            <div>
              {
                senderChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    userType="sender"
                    channel={channel}
                    channelSpend={this.getPreviousChannelSpend(channel.id)}
                    initPayment={this.initPayment}
                    verifySignature={this.verifySignature}
                    paymentAmountEth={paymentAmountEth}
                  />
                ))
              }
            </div>
            :
            <div> - </div>
          }

          <hr/>

          <h4>Recieving channels</h4>
          {
            recipientChannels.length > 0 ?
            <div>
              {
                recipientChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    userType="reciever"
                    channel={channel}
                    channelSpend={this.getPreviousChannelSpend(channel.id)}
                    closeChannel={this.closeChannel}
                    verifySignature={this.verifySignature}
                  />
                ))
              }
            </div>
            :
            <div> - </div>
          }
        </div>

        {
          !address &&
          <Overlay display="signin" />
        }

        {
          status === 'busy' &&
          <Overlay display="busy" />
        }

      </div>
    )
  }

}

export default App
