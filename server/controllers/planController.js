module.exports = models => ({
    async list(req, res) {
        try {
            const plans = await models.plan.findAll();
            res.status(200).send(plans);
        } catch (error) {
            res.status(500).send({
                error: {
                    user_message: 'Une erreur est survenue lors de la récupération des données en base',
                    developer_message: error.message,
                },
            });
        }
    },

    async find(req, res) {
        try {
            const plans = await models.plan.findOne(req.params.id);
            res.status(200).send(plans);
        } catch (error) {
            res.status(500).send({
                error: {
                    user_message: 'Une erreur est survenue lors de la récupération des données en base',
                    developer_message: error.message,
                },
            });
        }
    },

    async create(req, res) {
        try {
            await models.plan.create(
                Object.assign({}, req.body, {
                    createdBy: req.user.id,
                }),
            );
        } catch (error) {
            res.status(500).send({
                error: {
                    user_message: 'Une erreur est survenue lors de l\'écriture des données en base',
                    developer_message: error,
                },
            });
        }

        return res.status(200).send({});
    },
});