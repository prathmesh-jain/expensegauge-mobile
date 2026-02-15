"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictCategory = predictCategory;
var BayesClassifier = require('bayes-classifier');
var fs = require("fs");
var STORAGE_KEY = 'classifier_model';
function loadClassifier() {
    // }
    var saved = fs.readFileSync('classifier_model.json', 'utf8');
    var restored = new BayesClassifier().restore(JSON.parse(saved));
    if (restored) {
        return restored;
    }
}

function predictCategory(input) {
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
    const isFlat = probs.every(p => Math.abs(p.value - maxProb) ==0);

    if (isFlat) {
        return "Other";
    }


    return result;
}
// trainClassifier();
var res = predictCategory('rent for house');