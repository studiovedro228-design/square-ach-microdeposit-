const express = require('express');
const { Client, Environment } = require('square');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const client = new Client({
  environment: Environment.Production,
  accessToken: 'EAAAl5Sr5cjUVI_LLbt2GUHwmnZZCKMHYKEYH_nJ9jQUEsmvMvXnJXLbGlBAUPCv' // YOUR REAL PRODUCTION TOKEN
});

const { customersApi, bankAccountsApi } = client;
const pending = new Map();

app.post('/add', async (req, res) => {
  const { name, email, routing, account } = req.body;
  try {
    let customerId;
    const search = await customersApi.searchCustomers({ query: { filter: { emailAddress: { exact: email }}}});
    if (search.result.customers?.length) customerId = search.result.customers[0].id;
    else {
      const c = await customersApi.createCustomer({ givenName: name.split(' ')[0], familyName: name.split(' ').slice(1).join(' ') || ' ', emailAddress: email });
      customerId = c.result.customer.id;
    }

    const bank = await bankAccountsApi.createBankAccount({
      customerId,
      bankAccount: { accountNumber: account, routingNumber: routing, accountType: 'CHECKING', ownerName: name, verificationMethod: 'MICRODEPOSITS' }
    });

    pending.set(email.toLowerCase(), bank.result.bankAccount.id);
    res.json({ success: true, customerId });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/verify', async (req, res) => {
  const { email, amounts } = req.body;
  const bankId = pending.get(email.toLowerCase());
  if (!bankId) return res.json({ success: false, error: 'No pending bank' });

  try {
    await bankAccountsApi.verifyBankAccount(bankId, { amounts: amounts.map(a => parseInt(a)) });
    pending.delete(email.toLowerCase());
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: 'Wrong amounts' });
  }
});

app.listen(process.env.PORT || 3000, () => console.log('MR46 ACH Backend LIVE'));
