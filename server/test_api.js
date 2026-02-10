
// using global fetch

async function testApi() {
    try {
        console.log('Creating Company...');
        const res = await fetch('http://localhost:5000/api/companies', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // No Authorization header -> Uses Mock Admin User
            },
            body: JSON.stringify({
                name: "Test Company 2",
                domain: "test2.com",
                industry: "Tech",
                revenue: 500000
            })
        });

        if (res.ok) {
            console.log('✅ Company Created Successfully');
            const data = await res.json();
            console.log(data);
        } else {
            console.error('❌ Failed to Create Company:', res.status, res.statusText);
            const text = await res.text();
            console.error(text);
        }

        console.log('\nFetching User Profile...');
        const userRes = await fetch('http://localhost:5000/api/me');
        if (userRes.ok) {
            console.log('✅ User Profile Fetched Successfully');
            const user = await userRes.json();
            console.log(user);
        } else {
            console.error('❌ Failed to Fetch User:', userRes.status);
        }

    } catch (err) {
        console.error('API Test Error:', err);
    }
}

testApi();
