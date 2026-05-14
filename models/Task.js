const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    
    // Данные фигуры
    type: { type: String, default: 'rect' },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, default: 150 },
    height: { type: Number, default: 100 },
    color: { type: String, default: '#e14eca' },
    text: { type: String, default: '' } // На будущее, для текста внутри Канбан-карточки
});
module.exports = mongoose.model('Task', TaskSchema);