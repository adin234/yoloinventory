'use strict';

const config   = require(__dirname + '/config');
const importer = require('anytv-node-importer');
const upload   = require('multer')({dest: config.UPLOAD_DIR});

module.exports = (router) => {
    const __ = importer.dirloadSync(__dirname + '/../controllers');

    router.del = router.delete;

    router.get('/items/:id', __.item.get_item_details);

    router.post('/upload/items', upload.single('items'), __.transaction.upload_items);
    router.post('/upload/:type', upload.single('dr'), __.transaction.upload_transactions);

    router.post('/items', __.item.post_item);
    router.get('/items', __.item.get_items_table);

    router.get('/inventory/', __.item.render_table);
    router.get('/inventory/:id', __.item.render_item);

    router.all('*', (req, res) => {
        res.status(404)
            .send({message: 'Nothing to do here.'});
    });

    return router;
};
