'use strict';

const mysql   = require('anytv-node-mysql');
const winston = require('winston');
const moment  = require('moment');
const util    = require('../helpers/util');

exports.post_item = (req, res, next) => {
    const data = util.get_data({
            item_code: '',
            item_name: '',
            item_desc: '',
            item_beg_qty: ''
        }, req.body);
    
    function start () {
        if (data instanceof Error) {
            throw data
        }

        mysql.use('master')
            .query('INSERT INTO items VALUES (?)',
                [[data.item_code, data.item_name, data.item_desc, data.item_beg_qty]],
                send_response
            ).end();
    }

    function send_response (err, result, args, last_query) {
        if (err) {
            return next(err);
        }

        res.item(data)
            .send();
    }

    start();
};

exports.get_item_details = (req, res, next) => {
    const data = util.get_data({
            _start: '',
            _end: ''
        }, req.query);
    let output = {};
    let async = 2;
    let filter_start = data.start;
    let end = data.end;

    function start () {
        if (data instanceof Error) {
            throw data
        }

        if (!filter_start) {
            filter_start = '1970-01-01 00:00:00';
        }

        if (!end) {
            end = moment().add(1, 'days').format('YYYY-MM-DD HH:mm:ss');
        }

        mysql.use('master')
            .query('SELECT * FROM items WHERE item_code = ?', req.params.id, retrieve_item)
            .query('SELECT * FROM transactions WHERE item_code = ? AND date >= ? AND date < ?', 
                [req.params.id, filter_start, end], retrive_transactions)
            .end();
    }

    function retrieve_item (err, result) {
        if (err) {
            winston.warn(err);
            output.begin = 0;
        } else if (!result.length) {
            return next('Invalid item code');
        }

        output.begin = result[0].item_beg_qty;

        finalize_value();
    }

    function retrive_transactions(err, result) {
        output.transactions = { tr_in : [], tr_out: [], dr: [] };
        if (err) {
            winston.warn(err);
            result = [];
        }

        result.forEach(function(item) {
            output.transactions[item.type.replace('-', '_')]
                .push(item);
        });

        finalize_value();
    }

    function finalize_value() {
        if (!--async && !data.start) {
            compute_return();
        } else if (!async) {
            mysql.use('master')
                .query('SELECT * FROM transactions WHERE item_code = ? AND date < ?', 
                    [req.params.id, filter_start],
                    update_begin)
                .end();
        }
    }

    function update_begin(err, result) {
        if (err) {
            return next(err);
        }

        result.forEach(function (item) {
            switch (item.type) {
                case 'dr':
                case 'tr-out':
                    output.begin -= item.qty;
                    break;
                case 'tr-in':
                    output.begin += item.qty;
            }
        });

        async++;
        data.start = null;
        finalize_value();
    }

    function compute_return() {
        output.tr_in = (output.transactions.tr_in[0] && output.transactions.tr_in[0].qty) || 0;
        output.tr_out = (output.transactions.tr_out[0] && output.transactions.tr_out[0].qty) || 0;
        output.dr = (output.transactions.dr[0] && output.transactions.dr[0].qty)  || 0;

        if (output.transactions.tr_in.length > 1) {
            output.tr_in = output.transactions.tr_in.reduce(function (item1, item2) {
                return (item1.qty || item1) + item2.qty;
            });
        }

        if (output.transactions.tr_out.length > 1) {
            output.tr_out = output.transactions.tr_out.reduce(function (item1, item2) {
                return (item1.qty || item1) + item2.qty;
            });
        }

        if (output.transactions.dr.length > 1) {
            output.dr = output.transactions.dr.reduce(function (item1, item2) {
                return (item1.qty || item1) + item2.qty;
            });
        }

        output.end = output.begin - output.tr_out - output.dr + output.tr_in;

        res.item(output)
            .send();
    }

    start();
}