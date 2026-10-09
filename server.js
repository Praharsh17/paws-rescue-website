require('dotenv').config(); // <-- This tells Node to read your .env file
const express = require('express');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@sanity/client');
const fs = require('fs');

const app = express();
app.use(express.static('public'));
const port = 3000;

// Sanity Client Configuration
const client = createClient({
  projectId: '32aqddju', 
  dataset: 'production',
  useCdn: false,
  apiVersion: '2023-05-03',
  token: process.env.SANITY_TOKEN // <-- Now it securely reads from the hidden file!
});

// Middleware

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Multer configuration for handling image uploads
const upload = multer({ dest: 'uploads/' });

// ==========================================
// 1. PAGE ROUTES (What the user sees)
// ==========================================

// Home Page
app.get('/', (req, res) => {
  res.render('index');
});

// Adopt a Pet Form Page
app.get('/contact', (req, res) => {
  res.render('contact');
});

// Surrender a Pet Form Page
app.get('/surrender', (req, res) => {
  res.render('surrender');
});

// NEW: Meet the Animals Gallery
app.get('/animals', async (req, res) => {
  try {
    const query = `*[_type == "pet"]{
      _id,
      name,
      species,
      breed,
      age,
      "sex": gender,
      "imageUrl": image.asset->url
    }`;
    const pets = await client.fetch(query);
    res.render('animals', { pets: pets });
  } catch (error) {
    console.error("Error fetching pets:", error);
    res.status(500).send("Error loading animals. Please try again later.");
  }
});

// ==========================================
// 2. FORM SUBMISSION ROUTES (Backend logic)
// ==========================================

// Handle Adoption Application Submissions
app.post('/submit-adoption', async (req, res) => {
  try {
    const doc = {
      _type: 'application',
      applicantName: req.body.applicantName,
      phone: req.body.phone,
      email: req.body.email,
      address: req.body.address,
      petName: req.body.petName,
      housingType: req.body.housingType,
      ownership: req.body.ownership,
      hasYard: req.body.hasYard,
      householdMembers: req.body.householdMembers,
      currentPets: req.body.currentPets,
      agreedToTerms: req.body.agreedToTerms === 'on'
    };

    await client.create(doc);
    res.send('<h2>Application submitted successfully! We will contact you soon.</h2><a href="/">Return Home</a>');
  } catch (error) {
    console.error("Adoption Submission Error:", error);
    res.status(500).send("An error occurred while submitting your application.");
  }
});

// Handle Surrender Request Submissions (with Photo)
app.post('/submit-surrender', upload.single('petPhoto'), async (req, res) => {
  try {
    let imageAsset = null;

    // Upload the image to Sanity if the user attached one
    if (req.file) {
      imageAsset = await client.assets.upload('image', fs.createReadStream(req.file.path), {
        filename: req.file.originalname
      });
      fs.unlinkSync(req.file.path); // Clean up local file
    }

    const doc = {
      _type: 'surrender',
      guardianName: req.body.guardianName,
      phone: req.body.phone,
      email: req.body.email,
      altContact: req.body.altContact,
      address: req.body.address,
      relationship: req.body.relationship,
      petName: req.body.petName,
      species: req.body.species,
      breed: req.body.breed,
      age: req.body.age,
      sex: req.body.sex,
      spayedNeutered: req.body.spayedNeutered,
      medicalHistory: req.body.medicalHistory,
      temperament: req.body.temperament,
      surrenderReason: req.body.surrenderReason,
      itemsHandedOver: req.body.itemsHandedOver,
      agreedToTransfer: req.body.agreedToTransfer === 'on'
    };

    // Attach the image reference if an image was uploaded
    if (imageAsset) {
      doc.petPhoto = {
        _type: 'image',
        asset: {
          _type: "reference",
          _ref: imageAsset._id
        }
      };
    }

    await client.create(doc);
    res.send('<h2>Surrender request submitted successfully! We will contact you soon.</h2><a href="/">Return Home</a>');
  } catch (error) {
    console.error("Surrender Submission Error:", error);
    res.status(500).send("An error occurred while submitting your request.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Website server running at http://localhost:${port}`);
});