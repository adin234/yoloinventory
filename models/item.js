'use strict';

const mysql   = require('anytv-node-mysql');
const winston = require('winston');
const moment  = require('moment');
const util    = require('../helpers/util');

exports.get_all = (next) => {
	function start() {
		mysql.use('master')
			.query('SELECT * FROM items ORDER BY item_name asc', [], next)
			.end();
	}

	start();
}

exports.get_item = (code, filter_start, end, next) => {
	let output = {};
	let async = 2;

	function start() {
		mysql.use('master')
            .query('SELECT * FROM items WHERE item_code = ?', [code], retrieve_item)
            .query('SELECT * FROM transactions WHERE item_code = ? AND date >= ? AND date < ? ORDER BY date asc', 
                [code, filter_start, end], retrive_transactions)
            .end();
	}

	function retrieve_item (err, result) {
        if (err) {
            winston.warn(err);
            output.begin = 0;
            return next(err);
        } else if (!result.length) {
            return next('Invalid item code');
        }

        output.meta = result[0];
        output.begin = result[0].item_beg_qty;

        finalize_value();
    }

    function retrive_transactions(err, result) {
        output.transactions = { tr_in : [], tr_out: [], dr: [], flat: [] };
        if (err) {
            winston.warn(err);
            result = [];
        }

        result.forEach(function(item) {
        	item.date = moment(item.date).format('MM/DD/YYYY HH:mm:ss');
            output.transactions[item.type.replace('-', '_')]
                .push(item);
            output.transactions.flat.push(item);
        });

        finalize_value();
    }

    function finalize_value() {
        if (!--async && (filter_start == '1970-01-01 00:00:00')) {
            compute_return();
        } else if (!async) {
            mysql.use('master')
                .query('SELECT * FROM transactions WHERE item_code = ? AND date < ?', 
                    [code, filter_start],
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
        filter_start = '1970-01-01 00:00:00';
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

        next(null, output);
    }

    start();
}