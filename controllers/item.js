'use strict';

const mysql   = require('anytv-node-mysql');
const winston = require('winston');
const moment  = require('moment');
const async   = require('async');
const util    = require('../helpers/util');
const Item    = require('../models/item');

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

        Item.get_item(req.params.id, filter_start, end, send_response);
    }

    function send_response (err, result) {
        if (err) {
            return next(err);
        }

        res.item(result)
            .send();
    }

    start();
}

exports.get_items_table = (req, res, next) => {
    const data = util.get_data({
            _start: '',
            _end: ''
        }, req.query);
    
    let filter_start = data.start;
    let end = data.end;
    let parallel = []

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

        Item.get_all(get_details);
    }

    function get_details(err, result) {
        if (err) {
            return next(err);
        }

        if (!result.length) {
            return next('No items in database');
        }

        result.forEach(function (item) {
            parallel.push(function (done) {
                Item.get_item(item.item_code, filter_start, end, done)
            });
        });

        async.parallel(parallel, send_response);
    }

    function send_response (err, result) {
        if (err) {
            return next(err);
        }

        res.items(result)
            .send();
    }

    start();
}