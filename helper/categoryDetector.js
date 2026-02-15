const BayesClassifier = require('bayes-classifier');
const classifier_model= require('../classifier_model.json');



const loadClassifier = () => {
  // Load the saved classifier model  
  // var saved = fs.readFileSync('classifier_model.json', 'utf8');
  var restored = new BayesClassifier().restore(classifier_model);
  if (restored) {
    return restored;
  }
  return new BayesClassifier();
}

export function predictCategory(input) {
  // Remove special characters and irrelevant symbols, keeping only alphanumeric and spaces
  const cleanedInput = input.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  if (cleanedInput.length < 3) return "Other";
  const tokens = cleanedInput.split(/\s+/);

  if (tokens.length === 0) return "Other";
  const classifier = loadClassifier();
  const result = classifier.classify(cleanedInput.toLowerCase());
  const probs = classifier.getClassifications(cleanedInput.toLowerCase());

  if (!probs || probs.length === 0) return "Other";

  const maxProb = probs[0].value;

  // Check if all labels have similar (flat) probabilities
  const isFlat = probs.every(p => Math.abs(p.value - maxProb) < 0.001);

  if (isFlat) {
    return "Other";
  }

  // if (confidence < 0.3) return "Other"; // Custom threshold

  return result;
}