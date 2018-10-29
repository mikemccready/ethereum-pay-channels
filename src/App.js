import React, { Component } from 'react'
import abi from 'ethereumjs-abi'
import util from 'ethereumjs-util'
import './App.css'

let web3

class App extends Component {
  state = {
    channelContractAddress: '',
    paymentAmount: '',
    contractBalance: '',
    verifyMessage: ''
  }

  componentDidMount() {
    if (typeof window.web3 !== 'undefined') {
      window.web3 = new window.Web3(window.web3.currentProvider)
      web3 = window.web3
    } else {
      alert('no metamask')
    }
  }

  fetchInitialChannelAmount(e) {
    e.preventDefault()
    const { channelContractAddress } = this.state
    const contractBalance = web3.eth.getBalance(channelContractAddress, (err, balance) => {
      alert(balance)
      localStorage.setItem('contractAddress', channelContractAddress)
    })
  }

  constructPaymentMessage(e) {
    e.preventDefault()
    const { channelContractAddress, paymentAmount } = this.state

    const message = abi.soliditySHA3(
      [ 'address', 'uint256' ],
      [ channelContractAddress, paymentAmount ]
    )

    return this.signPaymentMessage(message)
  }

  signPaymentMessage(message) {
    const component = this

    web3.personal.sign(
      '0x' + message.toString('hex'),
      web3.eth.defaultAccount,
      (err, signedMessage) => component.setState({ signedMessage })
    )
  }

  verifyPayment(e) {
    e.preventDefault()

    const { channelContractAddress, paymentAmount, signedMessage } = this.state

    const verifyMessage = abi.soliditySHA3(
      [ 'string', 'address', 'uint256' ],
      [ '\x19Ethereum Signed Message:\n', channelContractAddress, paymentAmount ]
    )

    // const prefix = new Buffer("\x19Ethereum Signed Message:\n");
    // const prefixedMsg = abi.soliditySHA3(
    //   Buffer.concat([prefix, new Buffer(String(verifyMessage.length)), verifyMessage])
    // );

    console.log('verifying', '0x' + verifyMessage.toString('hex'), signedMessage)


    const split = util.fromRpcSig(signedMessage);
    const publicKey = util.ecrecover(verifyMessage, split.v, split.r, split.s);
    const signer = util.pubToAddress(publicKey).toString("hex");

    console.log('signer', signer, 'publicKey', publicKey, 'split', split)
    console.log('expected', util.stripHexPrefix('0xB45fe4e017cf0Ede6350fD0889BD636D92FB5f60'))
    // return signer;

  }

  render() {
    const { channelContractAddress, signedMessage } = this.state

    return (
      <div className="App">
        <form>
          <label>
            Enter Payment Channel Address
            <input
              type="text"
              onChange={e => this.setState({ channelContractAddress: e.target.value })} />
          </label>
          <button
            onClick={e => this.fetchInitialChannelAmount(e)}>
            View Initial Channel Amount
          </button>
        </form>

        {
          localStorage.getItem('contractAddress')
        }

        <br/><br/>

        Payment channel address
        <h3>{ channelContractAddress }</h3>

        <h1>Make a payment</h1>
        <form>
          <label>
            Enter amount
            <input
              type="text"
              onChange={e => this.setState({ paymentAmount: e.target.value })} />
          </label>
          <button
            onClick={e => this.constructPaymentMessage(e)}>
            Sign Payment
          </button>
        </form>

        { signedMessage }


        <br/><br/>

        <h1>Verify Payment</h1>
        <form>
          <label>
            Enter signed message
            <input
              type="text"
              onChange={e => this.setState({ verifyMessage: e.target.value })} />
          </label>
          <button
            onClick={e => this.verifyPayment(e)}>
            Verify payment
          </button>
        </form>
      </div>
    )
  }
}

export default App
