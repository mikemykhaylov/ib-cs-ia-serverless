import got from 'got';
import { gql, GraphQLClient } from 'graphql-request';

const UPDATE_BARBER = gql`
  mutation updateBarber($barberID: ID!, $input: UpdateBarberInput!) {
    updateBarber(barberID: $barberID, input: $input) {
      id
    }
  }
`;

interface Auth0ManagementToken {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
}

const handleImageUpload = async (event: AWSLambda.S3Event) => {
  const auth0Domain = 'https://dev-q6a92igd.eu.auth0.com';
  const graphQLDomain = 'https://u06740719i.execute-api.eu-central-1.amazonaws.com/dev/graphql';
  const managementToken: Auth0ManagementToken = await got
    .post(`${auth0Domain}/oauth/token`, {
      json: {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        audience: graphQLDomain,
        grant_type: 'client_credentials',
      },
    })
    .json();

  console.log(managementToken);

  const graphQLClient = new GraphQLClient(graphQLDomain, {
    headers: {
      Authorization: `${managementToken.token_type} ${managementToken.access_token}`,
    },
  });

  const filename = event.Records[0].s3.object.key.split('/')[1];
  const barberID = filename.split('.')[0];
  const profileImageURL = `https://ib-cyberpunk-barbershop-data.s3.eu-central-1.amazonaws.com/${filename}`;
  const data = await graphQLClient.request(UPDATE_BARBER, { barberID, input: { profileImageURL } });
  console.log(data);
};

export { handleImageUpload };
