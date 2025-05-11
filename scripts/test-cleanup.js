#!/usr/bin/env node

// Test script to trigger the cleanup API
// Run with: node scripts/test-cleanup.js

async function testCleanup() {
    try {
        console.log('Testing cleanup API...');
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const url = `${baseUrl}/api/cleanup`;

        console.log(`Sending request to: ${url}`);

        const response = await fetch(url);
        const data = await response.json();

        console.log('API Response:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log(`Success! Deleted ${data.deleted || 0} expired listings.`);
        } else {
            console.error('Error:', data.error);
        }
    } catch (error) {
        console.error('Failed to test cleanup API:', error);
    }
}

testCleanup();
