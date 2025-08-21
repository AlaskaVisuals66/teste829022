// server.js
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // npm install node-fetch@2
const path = require('path');

const app = express();

// Configurações Mercado Pago
const MP_ACCESS_TOKEN = 'APP_USR-3811061902338910-082020-0bf36771f9515a8eb63d82fd07e51593-2523204749';

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Servir páginas estáticas
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/contribuarafaela', (req, res) => {
  res.sendFile(path.join(__dirname, 'contribuarafaela', 'index.html'));
});

app.get('/contribuarafaela/pix03.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'contribuarafaela', 'pix03.html'));
});

// Criar pagamento PIX
app.post('/api/create-pix-payment', async (req, res) => {
  try {
    const { name, cpf, amount, description } = req.body;

    if (!name || !cpf || !amount) {
      return res.status(400).json({ error: 'Nome, CPF e valor são obrigatórios' });
    }

    if (amount < 10) {
      return res.status(400).json({ error: 'Valor mínimo é R$ 10,00' });
    }

    const paymentData = {
      transaction_amount: parseFloat(amount),
      description: description || 'Doação via PIX',
      payment_method_id: 'pix',
      payer: {
        first_name: name.split(' ')[0],
        last_name: name.split(' ').slice(1).join(' ') || name.split(' ')[0],
        identification: {
          type: 'CPF',
          number: cpf.replace(/\D/g, '')
        }
      }
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${Date.now()}-${Math.random()}`
      },
      body: JSON.stringify(paymentData)
    });

    const mpResponse = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: mpResponse.message || 'Erro desconhecido' });
    }

    res.json({
      transaction_id: mpResponse.id.toString(),
      status: mpResponse.status,
      qr_code: mpResponse.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64,
      amount: mpResponse.transaction_amount,
      currency: 'BRL'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Verificar status do pagamento
app.get('/verificar_status.php', async (req, res) => {
  try {
    const { hash } = req.query;
    if (!hash) return res.status(400).json({ error: 'Hash não fornecido' });

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${hash}`, {
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return res.status(404).json({ error: 'Pagamento não encontrado' });

    const payment = await response.json();

    res.json({
      status: payment.status,
      pix: {
        pix_qr_code: payment.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64
      },
      transaction_amount: payment.transaction_amount,
      currency_id: payment.currency_id
    });

  } catch (error) {
    console.error('Erro ao verificar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// CORS global
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); 
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Rodar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
