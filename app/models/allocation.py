from app import db

class ShareAllocationPrinciple(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    supplier = db.Column(db.String(200))
    ratio = db.Column(db.String(100))
    region = db.Column(db.String(200))


class EffectiveSupplierPrinciple(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50))
    effective_supplier_count = db.Column(db.String(200))
    candidate_count = db.Column(db.String(200))
    winner_count = db.Column(db.String(200))


class MultiShareAllocationPrinciple(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('project.id', ondelete='CASCADE'), nullable=False)
    seq_num = db.Column(db.String(50));
    winner_count = db.Column(db.String(100));
    rank_1 = db.Column(db.String(50));
    rank_2 = db.Column(db.String(50));
    rank_3 = db.Column(db.String(50));
    rank_4 = db.Column(db.String(50));
    rank_5 = db.Column(db.String(50));
    rank_6 = db.Column(db.String(50));
    rank_7 = db.Column(db.String(50));
    rank_8 = db.Column(db.String(50));
    rank_9 = db.Column(db.String(50));
    rank_10 = db.Column(db.String(50));
    rank_11 = db.Column(db.String(50));
    rank_12 = db.Column(db.String(50));
    rank_13 = db.Column(db.String(50));
    rank_14 = db.Column(db.String(50));
    rank_15 = db.Column(db.String(50));
    rank_16 = db.Column(db.String(50));
    rank_17 = db.Column(db.String(50));
    rank_18 = db.Column(db.String(50));
    rank_19 = db.Column(db.String(50));
    rank_20 = db.Column(db.String(50));
    rank_21 = db.Column(db.String(50));
    rank_22 = db.Column(db.String(50));
    rank_23 = db.Column(db.String(50));
    rank_24 = db.Column(db.String(50));
    rank_25 = db.Column(db.String(50));
    rank_26 = db.Column(db.String(50));
    rank_27 = db.Column(db.String(50));
    rank_28 = db.Column(db.String(50));
    rank_29 = db.Column(db.String(50));
    rank_30 = db.Column(db.String(50));
    rank_31 = db.Column(db.String(50));
    rank_32 = db.Column(db.String(50));
    rank_33 = db.Column(db.String(50));
    rank_34 = db.Column(db.String(50));
    rank_35 = db.Column(db.String(50));
    rank_36 = db.Column(db.String(50));
    rank_37 = db.Column(db.String(50));
    rank_38 = db.Column(db.String(50));
    rank_39 = db.Column(db.String(50));
    rank_40 = db.Column(db.String(50));
    rank_41 = db.Column(db.String(50));
    rank_42 = db.Column(db.String(50));
    rank_43 = db.Column(db.String(50));
    rank_44 = db.Column(db.String(50));
    rank_45 = db.Column(db.String(50));
    rank_46 = db.Column(db.String(50));
    rank_47 = db.Column(db.String(50));
    rank_48 = db.Column(db.String(50));
    rank_49 = db.Column(db.String(50));
    rank_50 = db.Column(db.String(50));
    notes = db.Column(db.Text)
