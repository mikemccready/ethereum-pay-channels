import React from 'react'

function ChannelItem(props) {
  const {
    channel,
    channelSpend,
    closeChannel,
    userType,
    verifySignature,
    paymentAmountEth,
    initPayment
  } = props;

  const web3 = window.web3;

  return (
    <div>
      { web3.utils.fromWei(channelSpend) } &nbsp; | &nbsp;
      { web3.utils.fromWei(channel.deposit.toString(), 'ether') } ETH &nbsp;

      {
        userType === 'sender' ?
        channel.recipient :
        channel.sender
      }

      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

      {
        channel.status === 'closed' &&
        <span>closed</span>
      }

      {
        channel.status === 'open' &&
        <span>
          {
            userType === 'sender' ?
            <button
              className="App__button--secondary"
              onClick={() => initPayment(channel.id)}>
              pay { paymentAmountEth } ETH
            </button>
            :
            <button
              className="App__button--secondary"
              onClick={() => closeChannel(channel.id)}
              disabled={channelSpend === 0}>
              close channel
            </button>
          }

          <button
            className="App__button--secondary"
            onClick={() => verifySignature(channel.id)}
            disabled={channelSpend === 0}>
            verify
          </button>
        </span>
      }

      <br/><br/>
    </div>
  )
}

export default ChannelItem;
