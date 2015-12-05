'use strict';

const mysql   = require('anytv-node-mysql');
const winston = require('winston');
const fs      = require('fs');
const Parse   = require('csv-parse');
const moment  = require('moment');

exports.upload_transactions = (req, res, next) => {
    let records = [];
    let errors = [];

    function start () {
        const file_path = req.file.path;
        if (
            (req.params.type == 'tr-in' && !~req.file.originalname.trim().toLowerCase().indexOf("transaction in")) ||
            (req.params.type == 'tr-out' && !~req.file.originalname.trim().toLowerCase().indexOf("transaction out")) ||
            (req.params.type == 'dr' && !~req.file.originalname.trim().toLowerCase().indexOf("sales"))
        ) {
            return next('Invalid File');
        }


        let columns = ['item_code', 'qty', 'tr_date', 'dr_number']; 

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

        records.forEach(function (item, i) {
            if (!item.item_code || !item.tr_date.trim().length 
                || !item.dr_number.trim().length || item.item_code.toLowerCase() == 'code') {
                return errors.push('Didn\'t save', JSON.stringify(item));
            }

            values.push([item.item_code, item.qty,
                moment(item.tr_date, 'MM/DD/YYYY HH:mm:ss').format('YYYY-MM-DD HH:mm:ss'), item.dr_number,
                req.params.type
            ]);
        });

        //console.log(values);

        mysql.use('master')
            .query('INSERT INTO transactions ( item_code, qty, date, dr_number, type ) VALUES ?', 
                [values],
                send_response
            ).end();
    }

    function send_response (err, result) {
        if (err) {
            return next(err);
        }

        res.items(errors)
            .send();
    }

    start();
};

exports.upload_items = (req, res, next) => {
    let records = [];
    let errors = [];

    function start () {
        const file_path = req.file.path;
        let columns = ['item_code', 'item_name', 'item_desc', 'item_beg_qty', 'item_unit']; 

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

        records.forEach(function (item, line) {
            if (!item.item_name || !item.item_unit || !item.item_name.trim().length 
                || !item.item_unit.trim().length || item.item_code.toLowerCase() == 'code') {
                return errors.push('Didn\'t save', JSON.stringify(item));
            }

            values.push([item.item_code, item.item_name, item.item_desc, item.item_beg_qty, item.item_unit.trim()]);
        });

        //console.log(values);

        mysql.use('master')
            .query('TRUNCATE TABLE items', [], () => {})
            .query('INSERT INTO items VALUES ?', 
                [values],
                send_response
            ).end();
    }

    function send_response (err, result) {
        if (err) {
            return next(err);
        }

        res.items(errors)
            .send();
    }

    start();
}
