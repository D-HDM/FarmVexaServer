const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
    dueDate: Date,
    completedAt: Date,
    relatedModule: { type: String, trim: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    recurrence: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'] },
}, { timestamps: true });

taskSchema.index({ farm: 1, status: 1 });
taskSchema.index({ assignedTo: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);