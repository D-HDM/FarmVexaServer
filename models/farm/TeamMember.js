const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teamMemberSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ['worker', 'vet', 'manager', 'other'], required: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, select: false },
    hireDate: Date,
    salary: { type: Number },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastLogin: Date,
    notes: { type: String, trim: true },
}, { timestamps: true });

teamMemberSchema.index({ farm: 1, role: 1 });

teamMemberSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

teamMemberSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('TeamMember', teamMemberSchema);