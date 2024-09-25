const API_ADDRESS = 'http://' + location.hostname // TODO: Change before prod

function CardImageForID({ id }) {
  return <img src={`/cards/${id}.png`} style={{width: '100%'}}/>;
}

export default CardImageForID;
