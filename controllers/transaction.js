'use strict';

const mysql   = require('anytv-node-mysql');
const winston = require('winston');
const fs      = require('fs');
const Parse   = require('csv-parse');
const moment  = require('moment');

exports.upload_transactions = (req, res, next) => {
    let records = [];

    function start () {
        const file_path = req.file.path;
        let columns = ['item_code', 'qty', 'unit', 'tr_date', 'dr_number']; 

        parse_csv(file_path, columns, on_new_record, on_error, done);
    }

    function parse_csv(file_source, columns, on_new_record, on_error, done){
        const source = fs.createReadStream(file_source);
        const parser = Parse({
            delimiter: ',', 
            columns: columns
        });

        let linesRead = 0;

        parser.on("readable", function(){
            let record;
            while (record = parser.read()) {
                linesRead++;
                on_new_record(record);
            }
        });

        parser.on("error", function(error){
            on_error(error)
        });

        parser.on("end", function(){
            done(linesRead);
        });

        source.pipe(parser);
    }

    function on_new_record(record){
        records.push(record);
    }

    function on_error(error){
        //console.log(error)
    }

    function done (lines_read) {
        let values = [];

        records.forEach(function (item) {
            values.push([item.item_code, item.qty, item.unit,
                moment(item.tr_date, 'MM/DD/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'), item.dr_number,
                req.params.type
            ]);
        });

        //console.log(values);

        mysql.use('master')
            .query('INSERT INTO transactions ( item_code, qty, unit, date, dr_number, type ) VALUES ?', 
                [values],
                send_response
            ).end();
    }

    function send_response (err, result) {
        if (err) {
            return next(err);
        }

        res.send("successfully uploaded");
    }

    start();
};

exports.upload_items = (req, res, next) => {
    let records = [];

    function start () {
        const file_path = req.file.path;
        let columns = ['item_code', 'item_name', 'item_desc', 'item_beg_qty']; 

        parse_csv(file_path, columns, on_new_record, on_error, done);
    }

    function parse_csv(file_source, columns, on_new_record, on_error, done){
        const source = fs.createReadStream(file_source);
        const parser = Parse({
            delimiter: ',', 
            columns: columns
        });

        let linesRead = 0;

        parser.on("readable", function(){
            let record;
            while (record = parser.read()) {
                linesRead++;
                on_new_record(record);
            }
        });

        parser.on("error", function(error){
            on_error(error)
        });

        parser.on("end", function(){
            done(linesRead);
        });

        source.pipe(parser);
    }

    function on_new_record(record){
        records.push(record);
    }

    function on_error(error){
        //console.log(error)
    }

    function done (lines_read) {
        let values = [];

        records.forEach(function (item) {
            values.push([item.item_code, item.item_name, item.item_desc, item.item_beg_qty]);
        });

        //console.log(values);

        mysql.use('master')
            .query('INSERT INTO items VALUES ?', 
                [values],
                send_response
            ).end();
    }

    function send_response (err, result) {
        if (err) {
            return next(err);
        }

        res.send("successfully uploaded");
    }

    start();
}
