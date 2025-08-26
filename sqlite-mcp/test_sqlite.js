#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();

// Test database connection
const db = new sqlite3.Database('/Users/abdulmajeed/Downloads/project/mini_lms.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('✅ Database connected successfully');
    
    // Test a simple query
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
        if (err) {
            console.error('Error querying tables:', err.message);
        } else {
            console.log('✅ Tables found:', rows.map(row => row.name));
        }
        db.close();
    });
});
