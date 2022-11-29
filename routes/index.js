var express = require('express');
var router = express.Router();
const stock_read_log = require('../models/stock_read_log');
const FileSystem = require("fs");
const _ = require('lodash')

router.use('/export-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.writeFile('./stock_read_log.json', JSON.stringify(list), (error) => {
      if (error) throw error;
  });

  console.log('stock_read_log.json exported!');
  res.json({statusCode: 1, message: 'stock_read_log.json exported!'})
});

router.use('/import-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.readFile('./stock_read_log.json', async (error, data) => {
      if (error) throw error;

      const list = JSON.parse(data);

      const deletedAll = await stock_read_log.deleteMany({});

      const insertedAll = await stock_read_log.insertMany(list);

      console.log('stock_read_log.json imported!');
  res.json({statusCode: 1, message: 'stock_read_log.json imported!'})
  });

  
})

router.use('/edit-repacking', async (req, res) => {
 
  const { body } = req
  const reject_qr_list = body.reject_qr_list
  const new_qr_list = body.new_qr_list

  // Update data child
  if(reject_qr_list.length > 0) {
    reject_qr_list.map(async(data) => {
      await stock_read_log.findOneAndUpdate({ payload: body.payload}, {
        $set: { "qr_list.$[v].status": 0, "qr_list.$[v].status_qc": 1} }, {arrayFilters: [{ "v.payload": data.payload }],
        upsert: true})
    })
  }

  // Insert data to child
  if(new_qr_list.length > 0) {
    new_qr_list.map(async(data) => {
      let stock = await stock_read_log.findOne({ payload: data.payload });
      stock = _.pick(stock, ['_id', 'company_id', 'payload', '__v', 'attribute_list', 'count', 'count_string', 'created_time', 'last_synced', 'last_updated', 'line_id', 'line_type', 'order_no', 'prodis_line_id', 'prodis_line_type', 'qr_list', 'scanned_time', 'status', 'status_qc', 'status_repacking', 'status_sync', 'qr_count'])
      
      await stock_read_log.findOneAndUpdate({ payload: body.payload, }, { $push: {
        "qr_list": stock
      }})
    })
  }

  if(reject_qr_list.length > 0 || new_qr_list.length > 0) {
    const stock = await stock_read_log.findOne({payload: body.payload})
    let count = 0
    stock.qr_list.map((data) => {
      if(data.status === 1) {
        count++
      }
    })

    await stock_read_log.updateOne({ payload: body.payload }, { qty: count })
  }

  res.json({
    statusCode: 1,
    message: 'Update data successfully'
  });

});

module.exports = router;
