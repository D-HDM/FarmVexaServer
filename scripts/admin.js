#!/usr/bin/env node
const mongoose = require('mongoose');
const readline = require('readline');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const blue = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';
const bold = '\x1b[1m';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        return true;
    } catch (error) {
        console.log(`${red}❌ Database connection failed: ${error.message}${reset}`);
        return false;
    }
}

async function showBanner() {
    console.log(`
${green}${bold}   ╔══════════════════════════════╗
   ║   🌾 FARMVEXA ADMIN CLI     ║
   ╚══════════════════════════════╝${reset}
`);
}

async function listAdmins() {
    const Admin = require('../models/admin/Admin');
    const admins = await Admin.find().select('-password');

    if (admins.length === 0) {
        console.log(`\n${yellow}⚠️  No admins found.${reset}\n`);
        return;
    }

    console.log(`\n${bold}📋 Admins (${admins.length}):${reset}\n`);
    admins.forEach((admin, i) => {
        const status = admin.isActive ? `${green}active${reset}` : `${red}inactive${reset}`;
        console.log(`  ${i + 1}. ${admin.name} │ ${admin.email} │ ${admin.role} │ ${status}`);
    });
    console.log('');
}

async function createAdmin() {
    const Admin = require('../models/admin/Admin');
    const bcrypt = require('bcryptjs');

    console.log(`\n${bold}➕ Create New Admin${reset}\n`);

    const name = await question('  Name: ');
    const email = await question('  Email: ');
    const phone = await question('  Phone: ');
    const password = await question('  Password: ');

    const roleInput = await question('  Role (super_admin/admin) [admin]: ');
    const role = roleInput || 'admin';

    const existing = await Admin.findOne({ email });
    if (existing) {
        console.log(`\n${red}❌ Admin with that email already exists.${reset}\n`);
        return;
    }

    await Admin.create({ name, email, phone, password, role });

    console.log(`\n${green}✅ Admin "${name}" created successfully.${reset}\n`);
}

async function manageAdmin() {
    const Admin = require('../models/admin/Admin');
    const admins = await Admin.find().select('-password');

    if (admins.length === 0) {
        console.log(`\n${yellow}⚠️  No admins found.${reset}\n`);
        return;
    }

    console.log(`\n${bold}🔧 Manage Admin${reset}\n`);
    admins.forEach((admin, i) => {
        const status = admin.isActive ? `${green}active${reset}` : `${red}inactive${reset}`;
        console.log(`  ${i + 1}. ${admin.name} (${admin.email}) [${status}]`);
    });

    const choice = await question(`\n  Select admin number (or 0 to cancel): `);
    const index = parseInt(choice) - 1;

    if (choice === '0' || isNaN(index) || index < 0 || index >= admins.length) {
        console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
        return;
    }

    const admin = admins[index];
    console.log(`\n  Selected: ${bold}${admin.name}${reset}`);
    console.log(`  1. Toggle active status`);
    console.log(`  2. Change role`);
    console.log(`  3. Reset password`);
    console.log(`  4. Delete admin`);
    console.log(`  0. Cancel`);

    const action = await question(`\n  Action: `);

    switch (action) {
        case '1':
            admin.isActive = !admin.isActive;
            await admin.save();
            console.log(`\n${green}✅ Status toggled to ${admin.isActive ? 'active' : 'inactive'}.${reset}\n`);
            break;
        case '2':
            const newRole = await question('  New role (super_admin/admin): ');
            if (['super_admin', 'admin'].includes(newRole)) {
                admin.role = newRole;
                await admin.save();
                console.log(`\n${green}✅ Role updated to "${newRole}".${reset}\n`);
            } else {
                console.log(`\n${red}❌ Invalid role.${reset}\n`);
            }
            break;
        case '3':
            const newPassword = await question('  New password: ');
            admin.password = newPassword;
            await admin.save();
            console.log(`\n${green}✅ Password reset.${reset}\n`);
            break;
        case '4':
            const confirm = await question(`  ${red}Type DELETE to confirm: ${reset}`);
            if (confirm === 'DELETE') {
                await Admin.findByIdAndDelete(admin._id);
                console.log(`\n${green}✅ Admin deleted.${reset}\n`);
            } else {
                console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
            }
            break;
        default:
            console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
    }
}

async function listCollections() {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const counts = {};

    for (const col of collections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        counts[col.name] = count;
    }

    console.log(`\n${bold}🗄️  Database Collections:${reset}\n`);
    let total = 0;
    collections.forEach((col) => {
        const count = counts[col.name];
        total += count;
        console.log(`  📦 ${col.name} │ ${count} documents`);
    });
    console.log(`\n  ${bold}Total: ${collections.length} collections, ${total} documents${reset}\n`);
}

async function dropCollection() {
    const collections = await mongoose.connection.db.listCollections().toArray();

    console.log(`\n${bold}🗑️  Drop Collection${reset}\n`);
    collections.forEach((col, i) => {
        console.log(`  ${i + 1}. ${col.name}`);
    });

    const choice = await question(`\n  Select collection number (or 0 to cancel): `);
    const index = parseInt(choice) - 1;

    if (choice === '0' || isNaN(index) || index < 0 || index >= collections.length) {
        console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
        return;
    }

    const colName = collections[index].name;
    const confirm = await question(`  ${red}Type "${colName}" to confirm DROP: ${reset}`);

    if (confirm === colName) {
        await mongoose.connection.db.collection(colName).drop();
        console.log(`\n${green}✅ Collection "${colName}" dropped.${reset}\n`);
    } else {
        console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
    }
}

async function dropDatabase() {
    console.log(`\n${red}${bold}⚠️  DROP ENTIRE DATABASE${reset}\n`);

    const dbName = mongoose.connection.db.databaseName;
    const confirm1 = await question(`  ${red}Type database name "${dbName}" to continue: ${reset}`);

    if (confirm1 !== dbName) {
        console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
        return;
    }

    const confirm2 = await question(`  ${red}This will DELETE ALL DATA. Type YES to confirm: ${reset}`);

    if (confirm2 !== 'YES') {
        console.log(`\n${yellow}⚠️  Cancelled.${reset}\n`);
        return;
    }

    await mongoose.connection.db.dropDatabase();
    console.log(`\n${green}✅ Database "${dbName}" dropped completely.${reset}\n`);
}

async function mainMenu() {
    while (true) {
        console.log(`${bold}${blue}   ┌─────────────────────────┐${reset}`);
        console.log(`${bold}${blue}   │   FARMVEXA ADMIN CLI    │${reset}`);
        console.log(`${bold}${blue}   ├─────────────────────────┤${reset}`);
        console.log(`${blue}   │  1. List Admins         │${reset}`);
        console.log(`${blue}   │  2. Create Admin        │${reset}`);
        console.log(`${blue}   │  3. Manage Admin        │${reset}`);
        console.log(`${blue}   │  4. List DB Collections │${reset}`);
        console.log(`${blue}   │  5. Drop Collection     │${reset}`);
        console.log(`${blue}   │  6. Drop Database       │${reset}`);
        console.log(`${blue}   │  0. Exit                │${reset}`);
        console.log(`${bold}${blue}   └─────────────────────────┘${reset}`);

        const choice = await question('\n  Select option: ');

        switch (choice) {
            case '1':
                await listAdmins();
                break;
            case '2':
                await createAdmin();
                break;
            case '3':
                await manageAdmin();
                break;
            case '4':
                await listCollections();
                break;
            case '5':
                await dropCollection();
                break;
            case '6':
                await dropDatabase();
                break;
            case '0':
                console.log(`\n${green}👋 Goodbye!${reset}\n`);
                await mongoose.connection.close();
                process.exit(0);
            default:
                console.log(`\n${yellow}⚠️  Invalid option.${reset}\n`);
        }
    }
}

(async () => {
    await showBanner();

    const connected = await connectDB();
    if (!connected) {
        process.exit(1);
    }

    console.log(`${green}✅ Connected to: ${mongoose.connection.host}${reset}`);
    console.log(`${green}📦 Database: ${mongoose.connection.db.databaseName}${reset}`);

    await mainMenu();
})();