const { fetchAllContracts, upsertContract } = require('../lib/contracts');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const contracts = await fetchAllContracts();
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ contracts });
    }

    if (req.method === 'PUT') {
      const body = req.body || {};
      const contracts = Array.isArray(body) ? body : body.contracts;
      if (!Array.isArray(contracts)) {
        return res.status(400).json({ error: 'Expected an array of contracts (or { contracts: [...] }).' });
      }
      const errors = [];
      for (const contract of contracts) {
        try {
          await upsertContract(contract);
        } catch (err) {
          errors.push({ id: contract && contract.id, error: err.message });
        }
      }
      if (errors.length) {
        return res.status(207).json({ saved: contracts.length - errors.length, errors });
      }
      return res.status(200).json({ saved: contracts.length });
    }

    res.setHeader('Allow', 'GET, PUT');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
